
all: install start

#-------------------------------------------------------------------------------
# Building

extern:
	mkdir extern

client/diff_match_patch.js: extern
	rm -rf extern/diff_match_patch* && \
	( test -e /tmp/diff_match_patch.zip || \
	  wget http://google-diff-match-patch.googlecode.com/files/diff_match_patch_20120106.zip \
	    -O /tmp/diff_match_patch.zip ) && \
	unzip /tmp/diff_match_patch.zip -d extern/ && \
	cp extern/diff_match_patch_*/javascript/diff_match_patch.js client/ && \
	chmod 644 client/diff_match_patch.js

# TODO switch to using a node.js package.json
install: extern client/diff_match_patch.js mongodb
	npm install diff_match_patch
	npm install express
	npm install socket.io
	npm install mongoose --mongodb:native
	npm install uglify-js
	sudo npm install nodemon -g
	sudo npm install forever -g

# see http://www.mongodb.org/display/DOCS/Quickstart+Unix
mongodb: FORCE
	sudo apt-get install -y mongodb
	test -e /data/db || sudo mkdir /data/db
	sudo chown `id -u` /data/db

#-------------------------------------------------------------------------------
# Running

log:
	mkdir log

test:
	#forever start -c . /usr/bin/mongod
	NODE_ENV=development \
	  nodemon -w server -w ../common server/syncserver.js \
	  | tee log/test.text
	#forever stop mongod

start: log
	#forever -o log/db.out.text -e log/db.err.text start \
	#  -c . /usr/bin/mongodb
	forever -o log/server.out.text -e log/server.err.text \
		--watch --minUpTime 500 --spinSleepTime 4000 \
		start server/syncserver.js

stop:
	forever stop server/syncserver.js
	#forever stop mongod

#-------------------------------------------------------------------------------

clean:
	rm -rf node_modules extern log

FORCE:

