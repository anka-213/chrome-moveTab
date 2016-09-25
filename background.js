// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


// Takes a function which takes a callback as its last argument
// and converts it to a promise, by using "resolve" as the callback.
function toPromise(fun, ...args){
    return new Promise((resolve,_err)=> fun(...args, resolve));
}

Function.prototype.toPromise = function(...args){
    return toPromise(this, ...args);
};

function spawn(genF, self) {
    return new Promise(function(resolve, reject) {
        var gen = genF.call(self);
        function step(nextF) {
            var next;
            try {
                next = nextF();
            } catch (e) {
                // finished with failure, reject the promise
                reject(e);
                return;
            }
            if (next.done) {
                // finished with success, resolve the promise
                resolve(next.value);
                return;
            }
            // not finished, chain off the yielded promise and `step` again
            Promise.resolve(next.value).then(function(v) {
                step(function() {
                    return gen.next(v);
                });
            }, function(e) {
                step(function() {
                    return gen.throw(e);
                });
            });
        }
        step(function() {
            return gen.next(undefined);
        });
    }
    );
}

const cmdDir = {"move-left": -1, "move-right": 1, "move-up": -1, "move-down": 1};
const cmdAxis = {"move-left": "left", "move-right": "left", "move-up": "top", "move-down": "top"};

chrome.commands.onCommand.addListener(function(command) {
  if (command == "toggle-pin") {
    // Get the currently selected tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Toggle the pinned status
      var current = tabs[0];
      chrome.tabs.update(current.id, {'pinned': !current.pinned});
    });
  } else if (cmdDir[command]) {
    spawn(function*() {
      let tabs = yield chrome.tabs.query.toPromise({active: true, currentWindow: true});
      let current = tabs[0];
      // console.table(tabs);
      
      let windows = yield chrome.windows.getAll.toPromise(null);
      windows = windows.filter(x=> x.state == "normal").sort((a,b)=> a.left- b.left);
      // console.table(windows);

      let iCurrentWin = windows.findIndex(w => current.windowId == w.id);
      let nextWin = windows[iCurrentWin + cmdDir[command]];
      if (!nextWin) {
        console.log("No such window");
        return;
      }
      yield chrome.tabs.move.toPromise(current.id, {windowId: nextWin.id, index: -1});

      chrome.tabs.update(current.id, {active: true});
      // chrome.windows.update(nextWin.id, {focused: true});

    }).catch(e => console.error(e));
  }
});
