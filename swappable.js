chrome.runtime.onInstalled.addListener(function() {
  // alert("Swappy has been installed! A Swappy folder in 'Other bookmarks' will be created" + 
  //   " if it does not already exist, along with a backup of your current Bookmark Bar bookmarks. " +
  //   "You can create Swappable bookmark folders in the 'Swappable' folder. Happy Swapping!");
  chrome.tabs.create({url: 'installed.html'});
  findOrCreateSwappableFolder();
  updateSwappableFolderId();
});

chrome.bookmarks.onCreated.addListener(function(id, newBookmark){
  if(newBookmark.parentId == '1') {
    bookmarkAddedToBar(newBookmark);
  }
});

/**
*   Removing the first bookmark in the bookmark is not currently supported.
*   Likely need to wait until Google provides the 'title' of removed nodes in the 
*   onRemoved removeInfo. For now, the first bookmark in Swappable folders must be 
*   removed from the swappable folder itself.
**/
chrome.bookmarks.onRemoved.addListener(function(id, removeInfo){
  if(removeInfo.parentId == '1' && removeInfo.index != 0){
    getActiveSwappableFolderId({'id':id, 'removed':true}, function(activeFolderId){
      chrome.bookmarks.getChildren(activeFolderId, function(nodes){
        chrome.bookmarks.removeTree(nodes[removeInfo.index].id);
      });
    });
  }
});

chrome.bookmarks.onMoved.addListener(function(id, moveInfo){
  chrome.bookmarks.get(id, function(movedNode){
    if(moveInfo.parentId == '1' && moveInfo.oldParentId != '1') {
      bookmarkAddedToBar(movedNode[0]);
    }
  });
});

document.addEventListener('DOMContentLoaded', function () {
  chrome.bookmarks.getChildren('2', function(bookmarkNodes){
    displaySwappableFolders(bookmarkNodes);
  });
  $('body').on('click', '.bookmark-folder', function() {
    if(!$(this).hasClass("active")){
      $(".active").removeClass("active");
      copyFromFolderToFolder($(this).attr('id'), "1");
      $(this).addClass("active");
    }
  });
  $('#help-link').on('click', function() {
    chrome.tabs.create({url: 'installed.html'});
  });
});

function findOrCreateSwappableFolder() {
  chrome.bookmarks.getChildren('2', function(nodes){
    for(var i=0; i<nodes.length; i++) {
      if (nodes[i].title == 'Swappable' && isFolder(nodes[i])) {
        return;
      }
    }
    // alert("Swappable folder not found. Creating it.");
    createSwappableFolder();
  });
}

function createSwappableFolder() {
  chrome.bookmarks.create(
    {'parentId' : '2', 'title' : 'Swappable'},
    function(newSwappableFolder) {
      chrome.bookmarks.create(
        {'parentId' : newSwappableFolder.id,'title' : 'Bookmarks Bar Backup'},
        function(newFolder) {
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

function bookmarkAddedToBar(newBookmark) {
  var indx = newBookmark.title.indexOf("_SWAPPABLE_");
  if(indx > -1) {
    chrome.bookmarks.update(
      newBookmark.id, 
      {'title': newBookmark.title.substring(0,indx)}, 
      function(_){}
    );
  }
  else {
    getActiveSwappableFolderId(newBookmark, function(id){
      chrome.bookmarks.create(
        {'parentId': id, 'title': newBookmark.title, 'url': newBookmark.url}, 
        function(){}        
      );
    });
  }
}

function isFolder(node) {
  return !node.url;
}

function clearBookmarkBar() {
  chrome.bookmarks.getChildren("1", function(bookmarks) {
    bookmarks.forEach(function(bookmark) {
      chrome.bookmarks.move(
        bookmark.id,
        {'index':0}
      );
      chrome.bookmarks.removeTree(bookmark.id); 
    });
  });
}

function copyFromFolderToFolder(fromBookmarkFolderId, toBookmarkFolderId) {
  var titleAppender = '';
  if(toBookmarkFolderId == "1") {
    clearBookmarkBar();
    titleAppender = '_SWAPPABLE_';
  }
  chrome.bookmarks.getChildren(fromBookmarkFolderId, function(bookmarks) {
    bookmarks.forEach(function(bookmark) {
      chrome.bookmarks.create(
        {'parentId': toBookmarkFolderId, 'title': bookmark.title + titleAppender, 'url': bookmark.url}, 
        function(newBookmark){
          copyFromFolderToFolder(bookmark.id, newBookmark.id);
        }
      );
    });
  });
}

function displaySwappableFolders(bookmarkNodes) {
  bookmarkNodes.forEach(function(node){
    if(node.title == "Swappable") {
      chrome.bookmarks.getChildren(node.id, function(folders){
        folders.forEach(function(folder){
          $('#bookmark-bars').append($("<button class='bookmark-folder' id=" + folder.id + ">" + folder.title + "</button>"));
        });
      });
      getActiveSwappableFolderId(null, function(id){
        $("#" + id).addClass("active");
      });
    }
  });
}


function getActiveSwappableFolderId(nodeToIgnore, callback) {
  chrome.bookmarks.getChildren('1', function(bookmarksBarNodes) {
    chrome.bookmarks.getChildren('2', function(otherBookmarksNodes){
      otherBookmarksNodes.forEach(function(node){
        if(node.title == "Swappable" && !node.url) {
          chrome.bookmarks.getChildren(node.id, function(swappableFolders){
            swappableFolders.forEach(function(folder){
              checkIfFolderMatchesBookmarkBar(folder, bookmarksBarNodes, nodeToIgnore, callback);
            });
          });
        }
      });
    });
  });
}

function checkIfFolderMatchesBookmarkBar(folder, bookmarksBarNodes, nodeToIgnore, callback) {
  chrome.bookmarks.getChildren(folder.id, function(nodes){
    if(nodeToIgnore){
      if(Math.abs(nodes.length - bookmarksBarNodes.length) != 1) {
        return false;
      }
      var numMissing = 0;
      for(var i = 0; i < nodes.length; i++) {
        if(nodeToIgnore.removed){
          if(!containsNode(bookmarksBarNodes, nodes[i])){
            numMissing += 1;
          }
        }
        else if(nodes[i].id != nodeToIgnore.id && !containsNode(bookmarksBarNodes, nodes[i])) {
          return false;
        }
      }
      if(nodeToIgnore.removed && numMissing > 1) {
        return false;
      }
      for(var i = 0; i < bookmarksBarNodes.length; i++) {
        if(bookmarksBarNodes[i].id != nodeToIgnore.id && !containsNode(nodes, bookmarksBarNodes[i])) {
          return false;
        }
      }      
    }
    else {
      if(nodes.length != bookmarksBarNodes.length) {
        return false;
      }
      for(var i = 0; i < nodes.length; i++) {
        if(!containsNode(bookmarksBarNodes, nodes[i])) {
          return false;
        }
      }
      for(var i = 0; i < bookmarksBarNodes.length; i++) {
        if(!containsNode(nodes, bookmarksBarNodes[i])) {
          return false;
        }
      }      
    }
    callback(folder.id);
  });
}

