#!/usr/bin/python

'''
LiveCoder.net

Copyright (c) 2012, Fritz Obermeyer
Licensed under the MIT license:
http://www.opensource.org/licenses/mit-license.php
'''

import sys
import json

if __name__ == '__main__':
  if len(sys.argv) < 2:
    stem = 'gallery'
  else:
    stem = sys.argv[1]
    if stem in ['help', '-h', '--help']:
      print 'usage: python jscat2js.py EXAMPLE.jscat EXAMPLE.js'
      sys.exit(1)

  jscat = open(stem + '.jscat')
  js = open(stem + '.js', 'w')

  js.write('// this file produced by:\n')
  js.write('// python jscat2js.py %s\n' % stem)
  js.write('\n')

  js.write('var %s_jscat = [\n' % stem)

  for line in jscat.readlines():
    js.write(json.dumps(line[:-1]) + ',\n')

  js.write('""].join("\\n");\n')

