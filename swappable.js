chrome.runtime.onInstalled.addListener(function() {
  alert("Installed");
  findOrCreateSwappableFolder();
  updateSwappableFolderId();
});

// chrome.runtime.onStartup.addListener(function(){
//   alert("started!");
//   updateSwappableFolderId();
// });

chrome.bookmarks.onCreated.addListener(function(id, newBookmark){
  if(newBookmark.parentId == '1') {
    addNewBookmarkToSwappableFolder(newBookmark);
  }
});

// document.addEventListener('DOMContentLoaded', function () {
//   getActiveSwappableFolderId(function(activeFolderId){
//     chrome.bookmarks.getTree(function(bookmarkNodes){
//       displaySwappableFolders(bookmarkNodes, false, activeFolderId);
//     });
//   });
//   $('body').on('click', '.bookmark-folder', function() {
//     copyFromFolderToFolder($(this).attr('id'), "1");
//   });
// });

function findOrCreateSwappableFolder() {
  alert("Checking for existence of swappable folder");
  chrome.bookmarks.getChildren('2', function(nodes){
    for(var i=0; i<nodes.length; i++) {
      if (nodes[i].title == 'Swappable' && isFolder(nodes[i])) {
        alert("Swappable found.");
        return;
      }
    }
    alert("Swappable folder not found. Creating it.");
    createSwappableFolder();
  });
}

function createSwappableFolder() {
  chrome.bookmarks.create(
    {'parentId' : '2', 'title' : 'Swappable'},
    function(newSwappableFolder) {
      console.log("Created swappable folder. Id is: " + newSwappableFolder.id);
      chrome.bookmarks.create(
        {'parentId' : newSwappableFolder.id,'title' : 'Bookmarks Bar Backup'},
        function(newFolder) {
          console.log("Created backup folder.");
          activeSwappableFolderId = newFolder.id;
          copyFromFolderToFolder('1', newFolder.id);
        }
      );
    }
  );
}

function containsNode(nodeList, node) {
  for(var i = 0; i < nodeList.length; i++){
    if(nodeList[i].title == node.title) {
      return true;
    }
  }
  return false;
}

function addNewBookmarkToSwappableFolder(newBookmark) {
  // alert("Bookmark added to bar. Adding to swappable folder");
  //Need to add new bookmarks with some identifier that it was created by swappable
}

function isFolder(node) {
  return !node.url;
}

function clearBookmarkBar() {
  chrome.bookmarks.getChildren("1", function(bookmarks) {
    bookmarks.forEach(function(bookmark) {
      chrome.bookmarks.removeTree(bookmark.id); 
    });
  });
}

function copyFromFolderToFolder(fromBookmarkFolderId, toBookmarkFolderId) {
  if(toBookmarkFolderId == "1") {
    clearBookmarkBar();
  }
  chrome.bookmarks.getChildren(fromBookmarkFolderId, function(bookmarks) {
    bookmarks.forEach(function(bookmark) {
      chrome.bookmarks.create(
        {'parentId': toBookmarkFolderId, 'title': bookmark.title, 'url': bookmark.url}, 
        function(newBookmark){
          copyFromFolderToFolder(bookmark.id, newBookmark.id);
        }
      );
    });
  });
}

function displaySwappableFolders(bookmarkNodes, parentIsSwappableFolder, activeFolderId) {
  if(parentIsSwappableFolder) {
    console.log("Parent is swappable");
    bookmarkNodes.forEach(function(bookmark) {
      var elementClass = "bookmark-folder"
      if(bookmark.id == activeFolderId) {
        elementClass += " active";
      }
      $('#bookmark-bars').append($("<button class='" + elementClass + "' id=" + bookmark.id + ">" + bookmark.title + "</button>"));
    });
  }
  else if(bookmarkNodes) {
    bookmarkNodes.forEach(function(bookmark) {
      if(bookmark.title == "Swappable") {
        displaySwappableFolders(bookmark.children, true, activeFolderId);
      }
      else {
        displaySwappableFolders(bookmark.children, false, activeFolderId);
      }
    });
  }
}


function getActiveSwappableFolderId(callback) {
  // alert("updating swappable id");
  chrome.bookmarks.getChildren('1', function(bookmarksBarNodes) {
    chrome.bookmarks.getChildren('2', function(otherBookmarksNodes){
      otherBookmarksNodes.forEach(function(node){
        if(node.title == "Swappable" && !node.url) {
          chrome.bookmarks.getChildren(node.id, function(swappableFolders){
            swappableFolders.forEach(function(folder){
              checkIfFolderMatchesBookmarkBar(folder, bookmarksBarNodes, callback);
            });
          });
        }
      });
    });
  });
}

function checkIfFolderMatchesBookmarkBar(folder, bookmarksBarNodes, callback) {
  chrome.bookmarks.getChildren(folder.id, function(nodes){
    for(var i = 0; i < nodes.length; i++) {
      if(!containsNode(bookmarksBarNodes, nodes[i])) {
        return;
      }
    }
    callback(folder.id);
  });
}