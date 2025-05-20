import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import {
  CONFIG_LIST,
  DEFAULT_DATETIME_FORMAT,
  DEFAULT_FILENAME_FORMAT,
} from '../constants';

const SettingItem: React.FC<{
  value: boolean;
  setValue: React.Dispatch<React.SetStateAction<boolean>>;
  label: string;
  id: string;
  onChange?: () => void;
}> = ({ label, value, setValue, id, onChange }) => {
  return (
    <div className="setting">
      <label
        htmlFor={id}
        className="toggle-label"
      >
        <input
          type="checkbox"
          id={id}
          checked={value}
          onChange={() => {
            chrome.storage.sync.set({ [id]: !value });
            setValue((p) => !p);
            if (onChange) onChange();
          }}
          className="toggle-checkbox"
        />
        <span className="toggle-switch"></span>
        <span className="toggle-text">{label}</span>
      </label>
    </div>
  );
};

const GithubIcon: React.FC<{
  className?: string;
}> = ({ className }) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 12 12"
    >
      <path
        fill="currentColor"
        d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0m0 .98C3.243.98 1 3.223 1 6a5.02 5.02 0 0 0 3.437 4.77l.045.005c.203.01.279-.129.279-.25l-.007-.854c-1.39.303-1.684-.674-1.684-.674c-.227-.58-.555-.734-.555-.734c-.454-.312.034-.306.034-.306c.365.026.604.288.708.43l.058.088c.446.767 1.17.546 1.455.418c.046-.325.174-.546.317-.672c-1.11-.127-2.277-.558-2.277-2.482c0-.548.195-.996.515-1.348l-.03-.085c-.064-.203-.152-.658.079-1.244l.04-.007c.124-.016.548-.013 1.335.522A4.8 4.8 0 0 1 6 3.408c.425.002.853.058 1.252.17c.955-.65 1.374-.516 1.374-.516c.272.692.1 1.202.05 1.33c.32.35.513.799.513 1.347c0 1.93-1.169 2.354-2.283 2.478c.18.155.34.462.34.93l-.006 1.378c0 .13.085.282.323.245A5.02 5.02 0 0 0 11 6C11 3.223 8.757.98 6 .98"
      />
    </svg>
  );
};

function App() {
  const [newTab, setNewTab] = useState<boolean>(false);
  const [threads, setThreads] = useState<boolean>(true);
  const [enableVideoControl, setEnableVideoControl] = useState<boolean>(true);
  const [replaceJpegWithJpg, setReplaceJpegWithJpg] = useState<boolean>(true);
  const [useHashId, setUseHashId] = useState<boolean>(false);
  const [useIndexing, setUseIndexing] = useState<boolean>(true);
  const [useDatetime, setUseDatetime] = useState<boolean>(true);
  const [enableDownloadMultipleMedia, setEnableDownloadMultipleMedia] =
    useState<boolean>(true);

  const [fileNameFormat, setFileNameFormat] = useState<string>(
    DEFAULT_FILENAME_FORMAT
  );
  const [dateTimeFormat, setDateTimeFormat] = useState<string>(
    DEFAULT_DATETIME_FORMAT
  );

  const isMobile =
    navigator &&
    navigator.userAgent &&
    /Mobi|Android|iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    chrome.storage.sync.get(CONFIG_LIST).then((res) => {
      setNewTab(!!res.setting_show_open_in_new_tab_icon);
      setThreads(!!res.setting_enable_threads);
      setEnableVideoControl(!!res.setting_enable_video_controls);
      setReplaceJpegWithJpg(!!res.setting_format_replace_jpeg_with_jpg);
      setUseHashId(!!res.setting_format_use_hash_id);
      setUseIndexing(!!res.setting_format_use_indexing);
      setUseDatetime(!!res.setting_format_use_datetime);
      setEnableDownloadMultipleMedia(
        !!res.setting_enable_download_multiple_media
      );
    });

    chrome.storage.sync
      .get(['setting_format_filename', 'setting_format_datetime'])
      .then((res) => {
        setFileNameFormat(
          res.setting_format_filename || DEFAULT_FILENAME_FORMAT
        );
        setDateTimeFormat(
          res.setting_format_datetime || DEFAULT_DATETIME_FORMAT
        );
      });
  }, []);

  const handleUseHashIdChange = () => {
    if (useHashId) {
      setUseIndexing(false);
      chrome.storage.sync.set({ setting_format_use_indexing: false });
    }
  };

  const handleUseIndexingChange = () => {
    if (useHashId) {
      setUseIndexing(false);
      chrome.storage.sync.set({ setting_format_use_indexing: false });
    }
  };
  useEffect(() => {
    if (useHashId) {
      setUseIndexing(false);
      chrome.storage.sync.set({ setting_format_use_indexing: false });
    }
  }, [useHashId]);

  return (
    <>
      <main className={'container ' + (isMobile ? 'mobile' : '')}>
        <div className="header">
          <h2>INSTA YOINK</h2>
          <a
            className="github"
            target="_black"
            rel="noopener,noreferrer"
            href="https://github.com/FlapShatner/instayoink"
          >
            <GithubIcon />
          </a>
        </div>

        <div className="settings">
          {/* <SettingItem
            value={newTab}
            setValue={setNewTab}
            label="Show `open in new tab` Icon"
            id="setting_show_open_in_new_tab_icon"
          /> */}
          <SettingItem
            value={replaceJpegWithJpg}
            setValue={setReplaceJpegWithJpg}
            label="Replace .jpeg with .jpg"
            id="setting_format_replace_jpeg_with_jpg"
          />
          <SettingItem
            value={useDatetime}
            setValue={setUseDatetime}
            label="Append datetime to filename"
            id="setting_format_use_datetime"
          />
          <SettingItem
            value={useHashId}
            setValue={setUseHashId}
            label="Use short ID in filename"
            id="setting_format_use_hash_id"
            onChange={handleUseHashIdChange}
          />
          <SettingItem
            value={enableDownloadMultipleMedia}
            setValue={setEnableDownloadMultipleMedia}
            label="Download all media in post"
            id="setting_enable_download_multiple_media"
          />
          {/* <SettingItem
            value={useIndexing}
            setValue={setUseIndexing}
            label="Append the index of the media to the end of filename. Shorter ID cannot be used."
            id="setting_format_use_indexing"
            onChange={handleUseIndexingChange}
          /> */}
          {/* <SettingItem
            value={enableVideoControl}
            setValue={setEnableVideoControl}
            label="Show Video Controls"
            id="setting_enable_video_controls"
          /> */}
          {/* <SettingItem
            value={threads}
            setValue={setThreads}
            label="Enable Threads download"
            id="setting_enable_threads"
          /> */}
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
