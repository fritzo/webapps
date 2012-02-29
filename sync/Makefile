
all: install start

#-------------------------------------------------------------------------------
# Building

extern:
	mkdir extern

server/client.js: server/syncclient.js
	@# use the closure compiler
	$(MAKE) -C .. sync/server/client.js

# TODO switch to using a node.js package.json
install: extern mongodb
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

test: server/client.js
	#forever start -c . /usr/bin/mongod
	NODE_ENV=development NODE_PORT=8080 \
	  nodemon -w server server/server.js \
	  | tee log/test.text
	#forever stop mongod

start: server/client.js log
	#forever -o log/db.out.text -e log/db.err.text start \
	#  -c . /usr/bin/mongodb
	NODE_PORT=8080 \
	forever -o log/server.out.text -e log/server.err.text \
		--watch --minUpTime 500 --spinSleepTime 4000 \
		start server/server.js

stop:
	forever stop server/server.js
	#forever stop mongod

#-------------------------------------------------------------------------------

clean:
	rm -rf node_modules extern log

FORCE:

