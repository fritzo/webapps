/*
 * caret: a jQuery plugin, version: (2011-12-05)
 * http://livecoder.net
 *
 * Caret is a jQuery plugin that makes it easy to
 * get and set the caret position in textarea elements.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

new function ($) {
  $.fn.caret = function (pos) {
    $this = $(this);
    var el = $this.get(0);

    // .caret() returns caret position
    if (pos === undefined) {

      // Firefox
      if (el.selectionStart || el.selectionStart == '0') {
        return el.selectionStart;
      }

      // IE
      if (document.selection) 
      {
        el.focus ();
        var Sel = document.selection.createRange();
        var SelLength = document.selection.createRange().text.length;
        Sel.moveStart ('character', -el.value.length);
        return Sel.text.length - SelLength;
      }
    }

    // .caret(pos) sets caret position
    else {

      // Firefox
      if (el.setSelectionRange) {
        el.setSelectionRange(pos, pos);
      }

      // IE
      else if (el.createTextRange) {
        var range = el.createTextRange();
        range.collapse(true);
        range.moveEnd('character', pos);
        range.moveStart('character', pos);
        range.select();
      }

      return $this;
    }
  };

  $.fn.getCaretPos = function () {
    $this = $(this);
    var n = $this.caret();
    var text = $this.val().slice(0,n);
    var x = text.match(/.*$/)[0].length;
    var y = (text.match(/\n/g) || []).length;
    return {n:n, x:x, y:y};
  };
}(jQuery);

