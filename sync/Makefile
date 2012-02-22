
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
install: extern client/diff_match_patch.js
	npm install diff_match_patch
	npm install express
	npm install socket.io
	npm install uglify-js
	sudo npm install nodemon -g
	sudo npm install forever -g

#-------------------------------------------------------------------------------
# Running

log:
	mkdir log

test:
	cd server && nodemon main.js

start: log
	export NODE_ENV=development
	@#export NODE_ENV=production
	forever -o log/out.text -e log/err.text \
		--watch --minUpTime 500 --spinSleepTime 4000 \
		start server/main.js

stop:
	forever stop server/main.js

#-------------------------------------------------------------------------------

clean:
	rm -rf node_modules extern log

FORCE:

