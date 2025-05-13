import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { DEFAULT_DATETIME_FORMAT, DEFAULT_FILENAME_FORMAT } from '../constants'
import JSZip from 'jszip'

export function openInNewTab(url: string) {
 try {
  chrome.runtime.sendMessage({ type: 'open_url', data: url })
 } catch {
  window.open(url, '_blank', 'noopener,noreferrer')
 }
}

async function forceDownload(blob: string, filename: string, extension: string) {
 const { setting_format_replace_jpeg_with_jpg } = await chrome.storage.sync.get(['setting_format_replace_jpeg_with_jpg'])
 if (setting_format_replace_jpeg_with_jpg) {
  extension = extension.replace('jpeg', 'jpg')
 }
 const a = document.createElement('a')
 a.download = filename + '.' + extension
 a.href = blob
 document.body.appendChild(a)
 a.click()
 a.remove()
}

export function getMediaName(url: string) {
 const name = url.split('?')[0].split('/').pop()
 return name ? name.substring(0, name.lastIndexOf('.')) : url
}

export interface DownloadParams {
 url: string
 username?: string
 datetime?: string | null | Dayjs
 fileId?: string
 profile?: boolean
 multiple?: boolean
}

function hashCode(str: string) {
 let hash = 0
 for (let i = 0; i < str.length; i++) {
  const char = str.charCodeAt(i)
  hash = (hash << 5) - hash + char
  hash = hash & hash
 }
 return hash >>> 0
}

export async function handleDownloadMany(data: any) {
 const zip = new JSZip()
 for (const item of data) {
  if (item.url) {
   console.log('handledownloadmany item', item)
   const { url, res } = item
   let posterName, postTime, fileId
   if (res) {
    posterName = res.owner?.username || res.user?.username // Added fallback for user.username
    postTime = dayjs.unix(res.taken_at)
    fileId = res.id || getMediaName(url)
   } else {
    console.log('Err: not find media details in handleDownloadMany for item:', item)
    // Fallback if res is not available
    posterName = 'unknown_user'
    postTime = dayjs() // Use current time as a fallback
    fileId = getMediaName(url) || `media_${Date.now()}` // Fallback fileId from URL or timestamp
   }
   const resource = await downloadResource({
    url: url,
    username: posterName,
    datetime: dayjs(postTime), // postTime is already a Dayjs object here
    fileId: fileId,
    multiple: true,
   })
   if (resource && resource.data && resource.filename && resource.extension) {
    zip.file(`${resource.filename}.${resource.extension}`, resource.data)
   } else {
    console.warn('Failed to get resource or resource parts missing for zipping item:', item.url, resource)
   }
  }
 }
 const content = await zip.generateAsync({ type: 'blob' })
 if (Object.keys(zip.files).length === 0) {
  console.warn('Zip file is empty. No files were added. Aborting download.')
  // Optionally, notify the user via UI: alert("No media could be prepared for download.");
  return
 }
 const blob = new Blob([content], { type: 'application/zip' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `IG_Media_${Date.now()}.zip`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 URL.revokeObjectURL(url)
}

export async function downloadResource({
 url,
 username,
 datetime,
 fileId,
 profile = false,
 multiple = false,
}: DownloadParams): Promise<{ data: Blob; filename: string; extension: string } | null | void> {
 //  console.log(`Downloading ${url}`)

 const {
  setting_format_datetime = DEFAULT_DATETIME_FORMAT,
  setting_format_filename = DEFAULT_FILENAME_FORMAT,
  setting_format_use_hash_id,
  setting_format_use_datetime,
 } = await chrome.storage.sync.get(['setting_format_datetime', 'setting_format_filename', 'setting_format_use_hash_id', 'setting_format_use_datetime'])

 // When setting_format_use_hash_id is true, we will hash the fileId. The mediaIndex will be meaningless.
 if (setting_format_use_hash_id && fileId && !profile) {
  fileId = hashCode(fileId).toString()
 }

 let calculatedFilename = fileId

 if (username && datetime && fileId) {
  console.log(`username: ${username}, datetime: ${datetime}, fileId: ${fileId}`)
  let formattedDatetime = datetime // datetime is Dayjs object or string/null
  if (setting_format_use_datetime) {
   if (dayjs(datetime).isValid()) {
    // Check if datetime is valid before formatting
    formattedDatetime = dayjs(datetime).format(setting_format_datetime)
   } else {
    // If datetime is invalid but setting_format_use_datetime is true,
    // decide on a fallback or leave as is (which might be an invalid date string)
    // For now, it will use the original invalid 'datetime' if formatting fails.
    // Or, one could choose to not include datetime in filename if it's invalid.
   }
  }

  let effectiveFilenameFormat = setting_format_filename
  if (!setting_format_use_datetime) {
   // Remove {datetime} and adjacent separators (hyphen or underscore)
   effectiveFilenameFormat = effectiveFilenameFormat.replace(/[_-]?{datetime}[_-]?/g, '')
  }

  calculatedFilename = effectiveFilenameFormat
   .replace(/{username}/g, username)
   .replace(/{datetime}/g, String(formattedDatetime)) // Ensure formattedDatetime is string for replace
   .replace(/{id}/g, fileId)
 }
 console.log('filename', calculatedFilename) // Original log was 'filename'
 if (!calculatedFilename) {
  calculatedFilename = getMediaName(url)
 }

 if (multiple) {
  try {
   const response = await fetch(url, {
    headers: !url.startsWith('blob:') ? new Headers({ Origin: location.origin }) : undefined,
    mode: !url.startsWith('blob:') ? 'cors' : undefined,
   })
   if (!response.ok) {
    console.error(`Failed to fetch ${url} for zipping: ${response.status} ${response.statusText}`)
    return null
   }
   const blobData = await response.blob()
   let extension = blobData.type.split('/').pop()?.toLowerCase() || 'bin'

   if (extension === 'bin' || extension === 'octet-stream' || blobData.type === '') {
    const urlPath = new URL(url).pathname // Use URL for robust path parsing
    const urlExt = urlPath.substring(urlPath.lastIndexOf('.') + 1).toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'mov'].includes(urlExt)) {
     extension = urlExt
    }
   }

   const { setting_format_replace_jpeg_with_jpg } = await chrome.storage.sync.get(['setting_format_replace_jpeg_with_jpg'])
   if (setting_format_replace_jpeg_with_jpg && extension === 'jpeg') {
    extension = 'jpg'
   }
   if (extension === '' || extension === 'octet-stream') extension = 'bin' // Final fallback for extension

   return { data: blobData, filename: calculatedFilename, extension }
  } catch (e) {
   console.error(`Error in downloadResource (multiple: true) for ${url}:`, e)
   return null
  }
 } else {
  // Logic for single download (multiple: false)
  if (url.startsWith('blob:')) {
   forceDownload(url, calculatedFilename, 'mp4') // Kept original 'mp4' for this specific path
   return
  }
  fetch(url, {
   headers: new Headers({
    Origin: location.origin,
   }),
   mode: 'cors',
  })
   .then(async (response) => {
    // Added async here to await chrome.storage.sync.get
    if (!response.ok) {
     throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.blob()
   })
   .then(async (blob) => {
    // Added async here
    let extension = blob.type.split('/').pop()?.toLowerCase() // Added toLowerCase for consistency
    const { setting_format_replace_jpeg_with_jpg } = await chrome.storage.sync.get(['setting_format_replace_jpeg_with_jpg'])
    if (setting_format_replace_jpeg_with_jpg && extension === 'jpeg') {
     extension = 'jpg'
    }
    const blobUrl = window.URL.createObjectURL(blob)
    forceDownload(blobUrl, calculatedFilename, extension || 'jpg')
   })
   .catch((e) => console.error(`Error in downloadResource (single download) for ${url}:`, e))
  return // This path does not return a value to its direct caller in an awaited context
 }
}

const mediaInfoCache: Map<string, any> = new Map() // key: media id, value: info json
const mediaIdCache: Map<string, string> = new Map() // key: post id, value: media id

const findAppId = () => {
 const appIdPattern = /"X-IG-App-ID":"([\d]+)"/
 const bodyScripts: NodeListOf<HTMLScriptElement> = document.querySelectorAll('body > script')
 for (let i = 0; i < bodyScripts.length; ++i) {
  const match = bodyScripts[i].text.match(appIdPattern)
  if (match) return match[1]
 }
 console.log('Cannot find app id')
 return null
}

function findPostId(articleNode: HTMLElement) {
 const pathname = window.location.pathname
 if (pathname.startsWith('/reels/')) {
  return pathname.split('/')[2]
 } else if (pathname.startsWith('/stories/')) {
  return pathname.split('/')[3]
 } else if (pathname.startsWith('/reel/')) {
  return pathname.split('/')[2]
 }
 const postIdPattern = /^\/p\/([^/]+)\//
 const aNodes = articleNode.querySelectorAll('a')
 for (let i = 0; i < aNodes.length; ++i) {
  const link = aNodes[i].getAttribute('href')
  if (link) {
   const match = link.match(postIdPattern)
   if (match) return match[1]
  }
 }
 return null
}

const findMediaId = async (postId: string) => {
 const mediaIdPattern = /instagram:\/\/media\?id=(\d+)|["' ]media_id["' ]:["' ](\d+)["' ]/
 const match = window.location.href.match(/www.instagram.com\/stories\/[^/]+\/(\d+)/)
 if (match) return match[1]
 if (!mediaIdCache.has(postId)) {
  const postUrl = `https://www.instagram.com/p/${postId}/`
  const resp = await fetch(postUrl)
  const text = await resp.text()
  const idMatch = text.match(mediaIdPattern)
  if (!idMatch) return null
  let mediaId = null
  for (let i = 0; i < idMatch.length; ++i) {
   if (idMatch[i]) mediaId = idMatch[i]
  }
  if (!mediaId) return null
  mediaIdCache.set(postId, mediaId)
 }
 return mediaIdCache.get(postId)
}

const getImgOrVideoUrl = (item: Record<string, any>) => {
 if ('video_versions' in item) {
  return item.video_versions[0].url
 } else {
  return item.image_versions2.candidates[0].url
 }
}

export const getUrlFromInfoApi = async (articleNode: HTMLElement, mediaIdx = 0): Promise<Record<string, any> | Record<string, any>[] | null> => {
 try {
  const {
   setting_enable_download_multiple_media,
   setting_format_datetime = DEFAULT_DATETIME_FORMAT,
   setting_format_filename = DEFAULT_FILENAME_FORMAT,
   setting_format_use_hash_id,
   setting_format_use_datetime,
   setting_format_replace_jpeg_with_jpg,
  } = await chrome.storage.sync.get([
   'setting_enable_download_multiple_media',
   'setting_format_datetime',
   'setting_format_filename',
   'setting_format_use_hash_id',
   'setting_format_use_datetime',
   'setting_format_replace_jpeg_with_jpg',
  ])
  const appId = findAppId()
  if (!appId) {
   console.log('Cannot find appid')
   return null
  }
  const postId = findPostId(articleNode)
  if (!postId) {
   console.log('Cannot find post id')
   return null
  }
  const mediaId = await findMediaId(postId)
  if (!mediaId) {
   console.log('Cannot find media id')
   return null
  }
  if (!mediaInfoCache.has(mediaId)) {
   const url = 'https://i.instagram.com/api/v1/media/' + mediaId + '/info/'
   const resp = await fetch(url, {
    method: 'GET',
    headers: {
     Accept: '*/*',
     'X-IG-App-ID': appId,
    },
    credentials: 'include',
    mode: 'cors',
   })

   if (resp.status !== 200) {
    console.log(`Fetch info API failed with status code: ${resp.status}`)
    return null
   }
   const respJson = await resp.json()
   mediaInfoCache.set(mediaId, respJson)
  }
  const infoJson = mediaInfoCache.get(mediaId)
  const data = infoJson.items[0]
  console.log(data)
  if ('carousel_media' in data) {
   // multi-media post
   if (setting_enable_download_multiple_media) {
    console.log('Downloading multiple media items as zip...')
    const items = data.carousel_media.map((i: any) => ({
     ...i,
     url: getImgOrVideoUrl(i),
     taken_at: i.taken_at,
     owner: i.owner?.username || data.owner.username,
     coauthor_producers: i.coauthor_producers?.map((i: any) => i.username) || [],
     origin_data: i,
    }))
    // return items;
    console.log('items', items)
    return items
   }

   const item = data.carousel_media[Math.max(mediaIdx, 0)]
   return {
    ...item,
    url: getImgOrVideoUrl(item),
    taken_at: data.taken_at,
    owner: item.owner?.username || data.owner.username,
    coauthor_producers: data.coauthor_producers?.map((i: any) => i.username) || [],
    origin_data: data,
   }
  } else {
   // single media post
   return {
    ...data,
    url: getImgOrVideoUrl(data),
    owner: data.owner.username,
    coauthor_producers: data.coauthor_producers?.map((i: any) => i.username) || [],
   }
  }
 } catch (e: any) {
  console.log(`Uncaught in getUrlFromInfoApi(): ${e}\n${e.stack}`)
  return null
 }
}

function adjustVideoButton(btns: NodeListOf<Element>) {
 btns.forEach((i) => {
  const btn = i.parentNode?.parentNode?.parentNode?.parentNode
  if (btn instanceof HTMLElement) {
   btn.style.zIndex = '999'
   btn.style.bottom = '3rem'
  }
 })
}

export function getParentArticleNode(node: HTMLElement | null) {
 if (node === null) return null
 if (node.tagName === 'ARTICLE') {
  return node
 }
 return getParentArticleNode(node.parentElement)
}

export function getParentSectionNode(node: HTMLElement | null) {
 if (node === null) return null
 if (node.tagName === 'SECTION') {
  return node
 }
 return getParentSectionNode(node.parentElement)
}

// export async function handleVideo() {
//    const { setting_enable_video_controls } = await chrome.storage.sync.get(['setting_enable_video_controls']);
//    if (!setting_enable_video_controls) return;
//    const videos = document.querySelectorAll('video');
//    for (let i = 0; i < videos.length; i++) {
//       if (videos[i].controls === true) continue;
//       videos[i].style.zIndex = '1';
//       videos[i].style.position = 'relative';
//       videos[i].controls = true;
//       videos[i].onvolumechange = () => {
//          const isMutingBtn = videos[i].parentElement?.querySelector(
//             'path[d="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0 .8.7 1.5 1.5 1.5h8.7l12.9 12.9c.9.9 2.5.3 2.5-1v-9.8c0-.4-.2-.8-.4-1.1l-22-22c-.3-.3-.7-.4-1.1-.4h-.6zm46.8 31.4-5.5-5.5C44.9 36.6 48 31.4 48 24c0-11.4-7.2-17.4-7.2-17.4-.6-.6-1.6-.6-2.2 0L37.2 8c-.6.6-.6 1.6 0 2.2 0 0 5.7 5 5.7 13.8 0 5.4-2.1 9.3-3.8 11.6L35.5 32c1.1-1.7 2.3-4.4 2.3-8 0-6.8-4.1-10.3-4.1-10.3-.6-.6-1.6-.6-2.2 0l-1.4 1.4c-.6.6-.6 1.6 0 2.2 0 0 2.6 2 2.6 6.7 0 1.8-.4 3.2-.9 4.3L25.5 22V1.4c0-1.3-1.6-1.9-2.5-1L13.5 10 3.3-.3c-.6-.6-1.5-.6-2.1 0L-.2 1.1c-.6.6-.6 1.5 0 2.1L4 7.6l26.8 26.8 13.9 13.9c.6.6 1.5.6 2.1 0l1.4-1.4c.7-.6.7-1.6.1-2.2z"]'
//          );
//          const isUnmutingBtn = videos[i].parentElement?.querySelector(
//             'path[d="M16.636 7.028a1.5 1.5 0 1 0-2.395 1.807 5.365 5.365 0 0 1 1.103 3.17 5.378 5.378 0 0 1-1.105 3.176 1.5 1.5 0 1 0 2.395 1.806 8.396 8.396 0 0 0 1.71-4.981 8.39 8.39 0 0 0-1.708-4.978Zm3.73-2.332A1.5 1.5 0 1 0 18.04 6.59 8.823 8.823 0 0 1 20 12.007a8.798 8.798 0 0 1-1.96 5.415 1.5 1.5 0 0 0 2.326 1.894 11.672 11.672 0 0 0 2.635-7.31 11.682 11.682 0 0 0-2.635-7.31Zm-8.963-3.613a1.001 1.001 0 0 0-1.082.187L5.265 6H2a1 1 0 0 0-1 1v10.003a1 1 0 0 0 1 1h3.265l5.01 4.682.02.021a1 1 0 0 0 1.704-.814L12.005 2a1 1 0 0 0-.602-.917Z"]'
//          );
//          if (videos[i].muted === false && isMutingBtn) {
//             isMutingBtn.parentElement?.parentElement?.parentElement?.click();
//          }
//          if (videos[i].muted === true && isUnmutingBtn) {
//             isUnmutingBtn.parentElement?.parentElement?.parentElement?.click();
//          }
//       };
//       const btns = videos[i].parentNode?.querySelectorAll('button svg path');
//       if (btns) {
//          adjustVideoButton(btns);
//       }
//    }
// }

export const checkType = () => {
 if (navigator && navigator.userAgent && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
  if (navigator && navigator.userAgent && /(iPhone|iPad|iPod|iOS)/i.test(navigator.userAgent)) {
   return 'ios'
  } else {
   return 'android'
  }
 } else {
  return 'pc'
 }
}

export async function fetchHtml() {
 const resp = await fetch(window.location.href, {
  referrerPolicy: 'no-referrer',
 })
 const content = await resp.text()
 const parser = new DOMParser()
 const doc = parser.parseFromString(content, 'text/html')
 return doc.querySelectorAll('script')
}
