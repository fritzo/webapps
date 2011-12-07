#!/usr/bin/python

import sys
import json

if __name__ == '__main__':
  if len(sys.argv) != 2:
    print 'usage: python jscat2js.py EXAMPLE.jscat EXAMPLE.js'
    sys.exit(1)

  stem = sys.argv[1]

  jscat = open(stem + '.jscat')
  js = open(stem + '.js', 'w')

  js.write('// this file produced via\n')
  js.write('// python jscat2js %s \n' % stem)
  js.write('//\n')

  js.write('var %s_jscat = [\n' % stem)

  for line in jscat.readlines():
    js.write(json.dumps(line) + ',\n')

  js.write('""].join("");\n')

