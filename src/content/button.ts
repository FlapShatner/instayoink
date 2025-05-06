import { CLASS_CUSTOM_BUTTON } from '../constants';
import type { IconClassName, IconColor } from '../types/global';
import { highlightsOnClicked } from './highlights';
import { postOnClicked } from './post';
import { postDetailOnClicked } from './post-detail';
import { profileOnClicked } from './profile';
import { handleProfileReel } from './profile-reel';
import { reelsOnClicked } from './reels';
import { storyOnClicked } from './stories';
import { handleThreadsButton } from './threads/button';
import { checkType, downloadResource } from './utils';

const svgDownloadBtn = `<svg xmlns="http://www.w3.org/2000/svg" style="padding:4px;" width="30" height="30"  x="0px" y="0px" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293a1 1 0 0 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 13.586V4a1 1 0 0 1 1-1"/><path fill="currentColor" d="M6 17a1 1 0 1 0-2 0v.6C4 19.482 5.518 21 7.4 21h9.2c1.882 0 3.4-1.518 3.4-3.4V17a1 1 0 1 0-2 0v.6c0 .778-.622 1.4-1.4 1.4H7.4c-.778 0-1.4-.622-1.4-1.4z"/></svg>`;

const svgNewtabBtn = `<svg xmlns="http://www.w3.org/2000/svg" style="padding: 4px;" width="30" height="30"  x="0px" y="0px" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m8 16l8-8m0 0v5m0-5h-5M5.4 3h13.2A2.4 2.4 0 0 1 21 5.4v13.2a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 18.6V5.4A2.4 2.4 0 0 1 5.4 3"/></svg>`;

const svgDownloadMultipleBtn = `<svg xmlns="http://www.w3.org/2000/svg" style="padding:4px;" width="30" height="30"  x="0px" y="0px"  viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5a2.25 2.25 0 0 1-2.25-2.25v-.75"/></svg>`;

function onClickHandler(e: MouseEvent) {
  // handle button click
  e.stopPropagation();
  e.preventDefault();
  const { currentTarget } = e;
  if (currentTarget instanceof HTMLAnchorElement) {
    if (window.location.origin === 'https://www.threads.net') {
      handleThreadsButton(currentTarget);
      return;
    }

    const pathPrefix = window.location.pathname;
    const pathnameList = pathPrefix.split('/').filter((e) => e);
    const isPostDetailWithNameInUrl =
      pathnameList.length === 3 && pathnameList[1] === 'p';
    const isReelDetailWithNameInUrl =
      pathnameList.length === 3 && pathnameList[1] === 'reel';

    let fn: (target: HTMLAnchorElement) => Promise<any> = postOnClicked;
    if (
      document
        .querySelector('section>main>div>header>section:nth-child(2)')
        ?.contains(currentTarget)
    ) {
      fn = profileOnClicked;
    } else if (pathPrefix.startsWith('/reels/')) {
      fn = reelsOnClicked;
    } else if (pathPrefix.startsWith('/stories/highlights/')) {
      fn = highlightsOnClicked;
    } else if (pathPrefix.startsWith('/stories/')) {
      fn = storyOnClicked;
    } else if (pathPrefix.startsWith('/reel/')) {
      fn = handleProfileReel;
    } else if (pathPrefix.startsWith('/p/')) {
      if (document.querySelector('div[role="dialog"]')) {
        fn = postOnClicked;
      } else {
        fn = postDetailOnClicked;
      }
    } else if (isPostDetailWithNameInUrl || isReelDetailWithNameInUrl) {
      fn = postDetailOnClicked;
    }

    fn(currentTarget);
  }
}

function createCustomBtn(
  svg: string,
  iconColor: IconColor,
  className: IconClassName
) {
  const newBtn = document.createElement('a');
  newBtn.innerHTML = svg;
  newBtn.className = CLASS_CUSTOM_BUTTON + ' ' + className;
  newBtn.setAttribute('style', `cursor: pointer;z-index: 0;color:${iconColor}`);
  newBtn.onmouseenter = () => {
    newBtn.style.setProperty('opacity', '0.6');
  };
  newBtn.onmouseleave = () => {
    newBtn.style.removeProperty('opacity');
  };
  if (className === 'newtab-btn') {
    newBtn.setAttribute('title', 'Open In New Tab');
    newBtn.setAttribute('target', '_blank');
    newBtn.setAttribute('rel', 'noopener,noreferrer');
  } else {
    newBtn.setAttribute('title', 'Download');
  }
  newBtn.addEventListener('click', onClickHandler);
  return newBtn;
}

export async function addCustomBtn(
  node: any,
  iconColor: IconColor,
  position: 'before' | 'after' = 'after'
) {
  const { setting_show_open_in_new_tab_icon } = await chrome.storage.sync.get([
    'setting_show_open_in_new_tab_icon',
  ]);
  const newtabBtn = createCustomBtn(svgNewtabBtn, iconColor, 'newtab-btn');
  const downloadBtn = createCustomBtn(
    svgDownloadBtn,
    iconColor,
    'download-btn'
  );
  if (position === 'before') {
    if (
      !(
        checkType() !== 'pc' && window.location.pathname.startsWith('/stories/')
      )
    ) {
      if (setting_show_open_in_new_tab_icon) {
        node.insertBefore(newtabBtn, node.firstChild);
      }
    }
    node.insertBefore(downloadBtn, node.firstChild);
  } else {
    if (
      !(
        checkType() !== 'pc' && window.location.pathname.startsWith('/stories/')
      )
    ) {
      if (setting_show_open_in_new_tab_icon) {
        node.appendChild(newtabBtn);
      }
    }
    node.appendChild(downloadBtn);
  }
}

export function addVideoDownloadCoverBtn(node: HTMLDivElement) {
  const newBtn = document.createElement('a');
  newBtn.innerHTML = svgDownloadBtn;
  newBtn.className = CLASS_CUSTOM_BUTTON;
  newBtn.setAttribute(
    'style',
    'cursor: pointer;position:absolute;left:4px;top:4px;color:white'
  );
  newBtn.setAttribute('title', 'Download Video Cover');
  newBtn.onmouseenter = () => {
    newBtn.style.setProperty('scale', '1.1');
  };
  newBtn.onmouseleave = () => {
    newBtn.style.removeProperty('scale');
  };
  newBtn.onclick = (e) => {
    e.stopPropagation();
    if (window.location.pathname.split('/')[2] === 'reels') {
      const bgEl = node.querySelector('[style*="background-image"]');
      if (bgEl) {
        const url = window
          .getComputedStyle(bgEl)
          .getPropertyValue('background-image')
          .match(/url\((.*)\)/)?.[1];
        if (url) {
          downloadResource({
            url: JSON.parse(url),
          });
        }
      }
    } else {
      const imgSrc = node.querySelector('img')?.getAttribute('src');
      if (imgSrc) {
        downloadResource({
          url: imgSrc,
        });
      }
    }
  };
  node.appendChild(newBtn);
}
