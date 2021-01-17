const createNewWindow = (
  tab,
  windowType,
  windowBounds,
  isFullscreen,
  isFocused,
) => {
  // new window options
  const opts = {
    tabId: tab.id,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    ...windowBounds,
  };

  if (isFullscreen) {
    return new Promise((resolve) => {
      chrome.windows.create(opts, (newWin) => {
        if (newWin !== undefined) {
          // this timeout is gross but necessary.
          // updating immediately fails
          setTimeout(() => {
            chrome.windows.update(newWin.id, { state: "fullscreen" }, () => {
              resolve([newWin, tab]);
            });
          }, 1000);
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    chrome.windows.create(opts, (newWin) => {
      if (newWin !== undefined) {
        resolve([newWin, tab]);
      } else {
        reject("Could not create new window");
      }
    });
  });
};
