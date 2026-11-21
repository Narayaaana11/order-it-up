'use client';

import { useEffect, useSyncExternalStore } from 'react';
import WindowControls from './WindowControls';

const subscribeToElectronCapability = () => () => {};
const getElectronCapability = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.getStatus);
const getServerElectronCapability = () => false;

export default function DesktopDragSurface() {
  const isElectron = useSyncExternalStore(
    subscribeToElectronCapability,
    getElectronCapability,
    getServerElectronCapability,
  );

  useEffect(() => {
    if (isElectron) {
      document.documentElement.dataset.oiuDesktopTitlebar = 'true';
      document.documentElement.dataset.floDesktopTitlebar = 'true';
      if (window.electronAPI?.platform) {
        document.documentElement.dataset.oiuPlatform = window.electronAPI.platform;
        document.documentElement.dataset.floPlatform = window.electronAPI.platform;
      }
    } else {
      delete document.documentElement.dataset.oiuDesktopTitlebar;
      delete document.documentElement.dataset.floDesktopTitlebar;
      delete document.documentElement.dataset.oiuPlatform;
      delete document.documentElement.dataset.floPlatform;
    }
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="desktop-drag-surface"
        className="oiu-title-bar flo-title-bar oiu-title-bar--root-drag flo-title-bar--root-drag flex shrink-0"
      />
      <WindowControls />
    </>
  );
}
