import dayjs from 'dayjs'
import { checkType, downloadResource, getMediaName, getUrlFromInfoApi, openInNewTab } from './utils'
import { handleDownloadMany } from './utils'

async function fetchVideoURL(containerNode: HTMLElement, videoElem: HTMLVideoElement) {
 const poster = videoElem.getAttribute('poster')
 const timeNodes = containerNode.querySelectorAll('time')
 const posterUrl = (timeNodes[timeNodes.length - 1].parentNode!.parentNode as any).href
 const posterPattern = /\/([^/?]*)\?/
 const posterMatch = poster?.match(posterPattern)
 const postFileName = posterMatch?.[1]
 const resp = await fetch(posterUrl)
 const content = await resp.text()
 const pattern = new RegExp(`${postFileName}.*?video_versions.*?url":("[^"]*")`, 's')
 const match = content.match(pattern)
 let videoUrl = JSON.parse(match?.[1] ?? '')
 videoUrl = videoUrl.replace(/^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/g, 'https://scontent.cdninstagram.com')
 videoElem.setAttribute('videoURL', videoUrl)
 return videoUrl
}

const getVideoSrc = async (containerNode: HTMLElement, videoElem: HTMLVideoElement) => {
 let url = videoElem.getAttribute('src')
 if (videoElem.hasAttribute('videoURL')) {
  url = videoElem.getAttribute('videoURL')
 } else if (url === null || url.includes('blob')) {
  url = await fetchVideoURL(containerNode, videoElem)
 }
 return url
}

async function getUrl() {
 const containerNode = document.querySelector<HTMLElement>('section main')
 if (!containerNode) return

 const pathnameList = window.location.pathname.split('/').filter((e) => e)
 const isPostDetailWithNameInUrl = pathnameList.length === 3 && pathnameList[1] === 'p'

 const mediaList = containerNode.querySelectorAll('li[style][class]')

 let url, res
 let mediaIndex = -1

 if (mediaList.length === 0) {
  // single img or video
  res = await getUrlFromInfoApi(containerNode)
  if (Array.isArray(res)) {
   return res.map((item) => ({
    url: item.url,
    res: item.res,
   }))
  }
  url = res?.url
  if (!url) {
   const videoElem: HTMLVideoElement | null = containerNode.querySelector('article  div > video')
   const imgElem = containerNode.querySelector('article  div[role] div > img')
   if (videoElem) {
    // media type is video
    if (videoElem) {
     url = await getVideoSrc(containerNode, videoElem)
    }
   } else if (imgElem) {
    // media type is image
    url = imgElem.getAttribute('src')
   } else {
    console.log('Err: not find media at handle post single')
   }
  }
 } else {
  // multiple media
  let dotsList
  if (checkType() === 'pc') {
   dotsList = isPostDetailWithNameInUrl
    ? containerNode.querySelectorAll('article>div>div:nth-child(1)>div>div:nth-child(2)>div')
    : containerNode.querySelectorAll('div[role=button]>div>div>div>div>div>div:nth-child(2)>div')
  } else {
   dotsList = containerNode.querySelectorAll(`article>div>div:nth-child(2)>div>div:nth-child(2)>div`)
  }
  mediaIndex = [...dotsList].findIndex((i) => i.classList.length === 2)
  if (mediaIndex === -1) {
   const idx = new URLSearchParams(window.location.search).get('img_index')
   if (idx) {
    mediaIndex = +idx - 1
   } else {
    mediaIndex = 0
   }
  }
  res = await getUrlFromInfoApi(containerNode, mediaIndex)
  if (Array.isArray(res)) {
   return res.map((item) => ({
    url: item.url,
    res: item.res,
   }))
  }
  url = res?.url
  if (!url) {
   const listElements = [
    ...containerNode.querySelectorAll<HTMLLIElement>(`:scope > div > div:nth-child(1) > div > div:nth-child(1) ul li[style*="translateX"]`),
   ]
   const listElementWidth = Math.max(...listElements.map((element) => element.clientWidth))
   const positionsMap = listElements.reduce<Record<string, HTMLLIElement>>((result, element) => {
    const position = Math.round(Number(element.style.transform.match(/-?(\d+)/)?.[1]) / listElementWidth)
    return { ...result, [position]: element }
   }, {})

   const node = positionsMap[mediaIndex]
   const videoElem = node.querySelector('video')
   const imgElem = node.querySelector('img')
   if (videoElem) {
    // media type is video
    url = await getVideoSrc(containerNode, videoElem)
   } else if (imgElem) {
    // media type is image
    url = imgElem.getAttribute('src')
   }
  }
 }
 return { url, res, mediaIndex }
}

export async function postDetailOnClicked(target: HTMLAnchorElement) {
 const { setting_format_use_indexing } = await chrome.storage.sync.get(['setting_format_use_indexing'])
 try {
  const data = await getUrl()
  if (Array.isArray(data)) {
   handleDownloadMany(data)
   return
  }
  if (!data?.url) throw new Error('Cannot get url')

  const { url, res, mediaIndex } = data
  console.log('url', url)
  if (target.className.includes('download-btn')) {
   let postTime, posterName, fileId
   if (res) {
    posterName = res.owner
    postTime = dayjs.unix(res.taken_at)
    fileId = res.origin_data?.id || getMediaName(url)
   } else {
    postTime = document.querySelector('time')?.getAttribute('datetime')
    const name = document.querySelector<HTMLDivElement>('section main>div>div>div>div:nth-child(2)>div>div>div>div:nth-child(2)>div>div>div')
    if (name) {
     posterName = name.innerText || posterName
    }
   }
   if (mediaIndex !== undefined && mediaIndex >= 0) {
    fileId = `${fileId}_${mediaIndex + 1}`
   }
   // if setting_format_use_indexing is disabled (by setting it to false), then we need to overwrite the fileId to getMediaName(url).
   // Otherwise, the fileId could be the res.origin_data?.id without indexing, and multiple media from the same post could yield
   // to same filename when indexing is disabled.
   if (!setting_format_use_indexing) {
    fileId = getMediaName(url)
   }
   downloadResource({
    url: url,
    username: posterName,
    datetime: dayjs(postTime),
    fileId: fileId || getMediaName(url),
   })
  } else {
   openInNewTab(url)
  }
 } catch (e: any) {
  alert('Post Detail Download Failed!')
  console.log(`Uncaught in postDetailOnClicked(): ${e}\n${e.stack}`)
 }
}
