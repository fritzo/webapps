/*
 * The Rational Keyboard
 * http://fritzo.org/keys
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

$(document).ready(function(){

  $('#showToolbar').hide().on('click', function(){
        $('#showToolbar').fadeOut(50);
        $('#toolbar').fadeIn(100);
      });

  $('#hideToolbar').on('click', function(){
        $('#toolbar').fadeOut(200);
        $('#showToolbar').fadeIn(50);
      });
});

