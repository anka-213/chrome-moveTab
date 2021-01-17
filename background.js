// Copyright (c) 2012 The Chrome Authors. All rights reserved.
// Copyright (c) 2016 Andreas Källberg. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


// Takes a function which takes a callback as its last argument
// and converts it to a promise, by using "resolve" as the callback.
function toPromise(fun, ...args){
    return new Promise((resolve,_err)=> fun(...args, resolve));
}
function toPromise(fun, ...args){
    return new Promise((resolve,reject)=> fun(...args, chromeCallback(resolve,reject)));
}

function chromeCallback(resolve, reject) {
  return (...args) =>
    chrome.runtime.lastError
     ? reject(chrome.runtime.lastError)
     : resolve(...args)
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
  if (cmdDir[command]) {
    spawn(function*() {
      let tabs = yield chrome.tabs.query.toPromise({active: true, currentWindow: true});
      let current = tabs[0];
      if (!current) {
        console.warn("No current tab");
        return;
      }
      // console.table(tabs);

      // when moving right, return true if b is to the right of a
      let inOrder = (a, b) => cmdDir[command]*(a[cmdAxis[command]] - b[cmdAxis[command]])

      let windows = yield chrome.windows.getAll.toPromise(null);
      let currentWin = windows.find(w => current.windowId == w.id);
      windows = windows.filter(x => x.state == "normal" && inOrder(x, currentWin)>0)
                       .sort(inOrder);
      // console.table(windows);

      let nextWin = windows[0];
      if (!nextWin) {
        console.log("No available window to the "+command.replace("move-",""));
        return;
      }
      yield chrome.tabs.move.toPromise(current.id, {windowId: nextWin.id, index: -1});

      chrome.tabs.update(current.id, {active: true, pinned: current.pinned});
      // chrome.windows.update(nextWin.id, {focused: true});

    }).catch(e => console.error(e));
  }
});
