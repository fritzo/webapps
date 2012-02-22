
all: install start

#-------------------------------------------------------------------------------
# Building

extern:
	mkdir extern

# TODO switch to using a node.js package.json
install: extern
	npm install diff_match_patch
	npm install express
	npm install socket.io
	npm install uglify-js
	sudo npm install nodemon -g
	sudo npm install forever -g
	( cd extern ; \
	  ( test -e socket.io && \
	    ( cd socket.io && git pull ) || \
	    git clone https://github.com/LearnBoost/socket.io.git ) )

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

