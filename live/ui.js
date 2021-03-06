/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

(function(){ // UI

var ui = {};

ui.reset = function () {
  coder.setSource(coder.getSource());
};

//------------------------------------------------------------------------------
// LocalStorage Persistence

// WARNING if multiple windows/tabs are open, only the latest will autosave
ui.getAutosave = function () {

  var changed = false;
  coder.oncompile(function(){ changed = true; });

  var autosave = function () {
    if (changed) {
      changed = false;
      localStorage.setItem('autosave.js', coder.getSource());
    }
    setTimeout(autosave, 500);
  };
  autosave();

  return localStorage.getItem('autosave.js');
};

ui.saveScript = function () {
  var name = String(Date.now()) + '.js';
  localStorage.setItem(name, coder.getSource());
  log('saved ' + name);
  ui.buildScriptList();
};

ui.loadScript = function (name) {
  log('loading ' + name);
  coder.setSource(localStorage.getItem(name));
};

ui.deleteScript = function (name) {
  localStorage.removeItem(name);
  ui.buildScriptList();
  log('deleted ' + name);
  $('#gallery td button').first().focus();
};

ui.listScripts = function () {

  var keys = new Array(localStorage.length);
  for (var i = 0, I = localStorage.length; i < I; ++i) {
    keys[i] = localStorage.key(i);
  }

  keys = keys.filter(function (key) { return /^[0-9]+\.js$/.test(key); });
  keys.sort();
  keys.reverse();

  return keys;
};

ui.buildScriptLink = function (key) {

  var create = function (tag) { return $(document.createElement(tag)); };

  var tr = create('tr');

  var fullSource = $.trim(localStorage.getItem(key));
  var briefSource = fullSource.replace(/\s+/g, ' ').substr(0,60) + '...';

  var collapse = function () {
    $('.fullPreview').filter(':not(:hidden)').slideUp(150)
      .prev().slideDown(50);
  };

  var full = create('pre')
    .append(create('code').text(fullSource))
    .attr('class', 'fullPreview')
     //.attr('title', 'click to collapse')
    .hide();
  var brief = create('pre')
    .append(create('code').text(briefSource))
    .attr('class', 'briefPreview')
    .attr('title', 'click to expand')
    .click(function(){
          collapse();
          brief.hide();
          full.slideDown(150);
        })
    .show();

  tr.append(create('td')
      .append(brief, full));
      // older simpler version
      //.click(function(){
      //      brief.slideToggle(50);
      //      full.slideToggle(150);
      //    }));

  var time_js = key.split('.');
  var time = Number(time_js[0]);
  var timeago = $.timeago(new Date(time));
  tr.append(create('td')
        .html(timeago)
        .attr('class', 'timeago')
        .attr('title', 'click to collapse')
        .click(collapse));

  tr.append(create('td')
      .attr('title', 'click to collapse')
      .click(collapse)
      .append(create('button')
          .html('load').attr('class','roundFlat')
          .attr('title', 'load in editor')
          .click(function(){ ui.loadScript(key); }))
      .append(create('button')
          .html('delete').attr('class','flatRound')
          .attr('title', 'delete from local storage')
          .click(function(){
            tr.fadeOut(150, function(){ ui.deleteScript(key); });
          })));

  return tr;
};

ui.buildScriptList = function () {
  var create = function (tag) { return $(document.createElement(tag)); };

  var keys = ui.listScripts();

  $('#galleryCount').html(' (' + keys.length + ')');

  var menu = $('#gallery table').empty();
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];
    menu.append(ui.buildScriptLink(key));
  }
  menu.append(create('tr').css('height','3ex'));
};

//------------------------------------------------------------------------------
// Import/Export

ui.exportGallery = function () {
  var keys = ui.listScripts();

  var sep = '\n\n'
          + '//======================================'
          + '========================================'
          + '\n'
          + '// ';
  var scripts = [];
  for (var i = 0; i < keys.length; ++i) {
    var name = keys[i];
    var script = localStorage.getItem(name).trim();
    scripts[i] = sep + name + '\n\n' + script;
  }

  return scripts.join('');
};

ui.importGallery = function (concatenatedScripts) {
  var sep = /^\/\/={40,}\n\/\/\s*(?=[0-9]+\.js$)/gm;
  var scripts = concatenatedScripts.split(sep).slice(1);

  //console.log('importing ' + scripts.length + ' files');
  for (var i = 0; i < scripts.length; ++i) {
    try {
      var name_script = scripts[i];
      var name = name_script.match(/^[0-9]+\.js\b/)[0];
      var script = name_script.slice(name.length).trim();

      //console.log(' importing ' + name);
      localStorage.setItem(name, script);
    } catch (err) { alert(err); }
  }

  ui.buildScriptList();
};

//------------------------------------------------------------------------------
// Hash Persistence

ui.getHash = function () {
  var hashedSource = btoa(coder.getSource());
  return window.location.href.replace(/\/?#.*/,'') + '#a=' + hashedSource;
};

ui.popHash = function () {
  if (window.location.hash && window.location.hash.length > 1) {
    var hash = window.location.hash.substr(1);
    window.location.hash = '';
    if (hash.substr(0,2) === 'a=') {
      return atob(hash.substr(2));
    } else {
      // only for compatibility with older version
      return decodeURIComponent(hash);
    }
  } else {
    return undefined;
  }
};

ui.shareHash = function () {
  var href = ui.getHash();
  var html = "<iframe width='480' height='240' src='" + href + "'></iframe>";
  var mailto = $('#shareTemplate').attr('href') + encodeURIComponent(href);

  $('#shareBoxCopied').hide();
  $('#shareBox').fadeIn(100);
  $('#shareBoxText').val(href).focus().select();
  $('#shareSubmit').attr('href', mailto);
  $('#shareBoxHtml').val(html);

  if (window.clipboardData) {
    window.clipboardData.setData(href);
    $('#shareBoxCopied').show();
  }
};

//------------------------------------------------------------------------------
// Jamming

ui.jam = (function(){
  if (!(this.syncCoder && this.syncChatter)) return undefined;

  var serverUrl = 'http://localhost:8080';

  var jamming;
  var onchange;

  var source; // keep an extra copy for sync polling
  var getSource = function () {
    return source;
  };
  var setSource = function (text) {
    coder.setSource(source = text);
  };
  coder.oncompile(function(){
    if (onchange) {
      source = coder.getSource();
      onchange();
    }
  });

  var oldMaxCodeSize;
  var start = function () {
    if (jamming) return;

    oldMaxCodeSize = coder.getMaxCodeSize();

    var onlogin = function (username) {
      localStorage.setItem('username', username);

      coder.setMaxCodeSize(syncCoder.MAX_CODE_SIZE);

      assert(jamming, 'tried to login while not jamming');
      jamming.code = syncCoder({
        serverUrl: serverUrl,
        setSource: setSource,
        getSource: getSource,
        setCursor: coder.setCursor,
        getCursor: coder.getCursor,
        onchange: function (cb) { onchange = cb; }
      });

      $('#editor').show();
      coder.focus();
    };

    jamming = {
      chat: syncChatter({
        serverUrl: serverUrl,
        $read: $('#chatRead'),
        $write: $('#chatWrite'),
        onlogin: onlogin
      })
    };

    coder.setSource('');
    $('#editor').hide();
    $('#toolbar').css('right', '20%');
    $('#jamButton').text('leave jam');
    $('#chat').fadeIn(100, function(){
          var username = localStorage.getItem('username');
          var write = $('#chatWrite').focus().val(username)[0];
          write.selectionStart = 0;
          write.selectionEnd = username.length;
        });
  };

  var stop = function () {
    if (!jamming) return;

    coder.setMaxCodeSize(oldMaxCodeSize);

    onchange = undefined;
    jamming.chat.close();
    if (jamming.code) jamming.code.close();
    jamming = undefined;

    $('#editor').show();
    $('#toolbar').css('right', '0');
    $('#jamButton').text('join jam');
    $('#chat').fadeOut(100);
  };

  return {
    start: start,
    stop: stop,
    toggle: function () { jamming ? stop() : start(); }
  };
})();

//------------------------------------------------------------------------------
// Admin

window.su = function () {
  // turn on the ugly stuff
  $('#importExport, #su').show();
  localStorage.setItem('su', Date.now());
};

window.su.exit = function () {
  // turn off the ugly stuff
  $('#importExport, #su').hide();
  localStorage.removeItem('su');
};

//------------------------------------------------------------------------------
// Main

ui.blink = function ($button) {
  $button.css({opacity:0}).animate({opacity:1},'fast');
};

$(window).keydown(function (event) {
  switch (event.which) {

    // ESCAPE = hold/continue compiling
    case 27:
      coder.toggleCompiling();
      event.preventDefault();
      break;

    // CTRL+C to reset
    case 67:
      if (!event.ctrlKey) break;
    //case ???: // cmd+C on mac
      ui.blink($('#resetButton'));
      ui.reset();
      event.preventDefault();
      break;

    // CTRL+S to save
    case 115: // WTF?
    case 83:
      if (!event.ctrlKey) break;
    case 19: // cmd+S on mac
      ui.blink($('#saveButton'));
      ui.saveScript();
      event.preventDefault();
      break;

    // CTRL+O to show gallery
    case 79:
      if (!event.ctrlKey) break;
    //case ???: // cmd+O on mac
      ui.blink($('#galleryButton'));
      $('#gallery').fadeToggle('fast');
      ui.buildScriptList();
      event.preventDefault();
      break;

    // F1 = show language help
    case 112:
      ui.blink($('#helpButton'));
      var $help = $('#help');
      if ($help.is(':hidden')) {
        $help.show();
        $('#help a').first().focus();
        $('#F1target')[0].scrollIntoView();
      } else {
        $help.hide();
        coder.focus();
      }
      event.preventDefault();
      break;

    // F2 = show keyboard shortcuts
    case 113:
      ui.blink($('#helpButton'));
      var $help = $('#help');
      if ($help.is(':hidden')) {
        $help.show();
        $('#help a').first().focus();
        $('#F2target')[0].scrollIntoView();
      } else {
        $help.hide();
        coder.focus();
      }
      event.preventDefault();
      break;
  }
});

$(function() {

  // set local title while developing
  if (document.location.hostname.toLowerCase() !== 'livecoder.net') {
    document.title = ( document.location.hostname
                     + document.location.pathname ).replace(/\/$/,'');
  }

  // build editor

  var hideOverlays = function () {
    $('#gallery,#shareBox,#help').fadeOut('fast');
  };
  $('#log,#chat textarea').on('focus', hideOverlays);

  // XXX HACK FIXME
  $('#log')
      .attr('title','resize with arrow keys')
      .keydown(function(event){
            var $log = $(event.target);
            var dheight = 0;
            switch (event.which) {
              case 38: dheight = 20; break;
              case 40: dheight = -20; break;
              default: return;
            };
            var height = Number($log.css('height').replace('px',''));
            var maxHeight = window.innerHeight * 2/3;
            height = Math.max(30, Math.min(maxHeight, height + dheight));
            $log.css('height', height + 'px');
          });

  if ('su' in localStorage) su();
  $('#su').click(su.exit).attr('title', 'leave superuser mode');

  $('#helpButton').click(function(){
        var $help = $('#help');
        if ($help.is(':hidden')) {
          $help.fadeIn(100);
          $('#help a').first().focus();
        } else {
          $help.fadeOut(100);
          coder.focus();
        }
      });
  //$('#help').click(function(){ $('#help').fadeToggle(100); });

  $('#playButton').click(function(){ TODO('implement play'); });
  $('#pauseButton').click(function(){ TODO('implement pause'); });
  $('#recordButton').click(function(){ TODO('implement record'); });

  $('#resetButton').click(ui.reset);
  $('#saveButton').click(ui.saveScript);
  $('#galleryButton').click(function(){
    $('#gallery').fadeToggle('fast');
    ui.buildScriptList();
  });
  $('#shareButton').click(ui.shareHash);

  if (ui.jam) {
    $('#jamButton').click(ui.jam.toggle);
  } else {
    $('#jamButtonSpan').hide();
  }

  $('#export').click(function(){
        $('#galleryBox').val(ui.exportGallery).focus().select();
      });
  $('#import').click(function(){
        ui.importGallery($('#galleryBox').val());
      });

  $('#hideButton').click(function(){
        $('.hidableButtons').fadeToggle(100);
      });

  // initialize livecoder

  var initSource = (ui.popHash() || ui.getAutosave() || '').trim();
  $.get('gallery.jscat', function(val){ ui.importGallery(val); });

  // hide buttons if window is an iframe
  if (window.location != window.parent.location) {
    $('.hidableButtons').hide();
  }

  var canvas2d = document.getElementById('canvas2d');
  coder.init({
        $source: $('#source'),
        $log: $('#log'),
        $status: $('.statusFace'),
        canvas2d: canvas2d,
        initSource: initSource,
        onFocus: hideOverlays
      });

  coder.focus();
});

})(); // UI

