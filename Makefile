
#-------------------------------------------------------------------------------
# export to public git repository

LV = ~/livecoder.net/client
livecoder.net: FORCE
	rm -rf $(LV)
	cp -rL live $(LV)
	rm -rf $(LV)/temp*
	sed -i 's/localhost:8080/livecoder.nodester.com/g' $(LV)/ui.js $(LV)/index.html

RK = ~/rationalkeyboard/keys
rationalkeyboard: FORCE
	rm -rf $(RK)
	cp -rL keys $(RK)
	mv $(RK)/release.manifest $(RK)/cache.manifest
	for js in $$(cat keys/index.html keys/synthworker.js | \
			grep -o 'common\/.*\.\(js\|css\)');\
		do cp $$js $(RK)/; \
	done
	sed -i 's/\.\.\/common\///g' $(RK)/*.html $(RK)/*.js $(RK)/cache.manifest
	sed -i 's/http:\/\/fritzo\.org\/keys/http:\/\/fritzo\.org\/keys\n * http:\/\/github.com\/fritzo\/rationalkeyboard/g' $(RK)/*.js
	sed -i 's/ http:\/\/fritzo\.org\/keys/ http:\/\/fritzo\.org\/keys\n  http:\/\/github.com\/fritzo\/rationalkeyboard/g' $(RK)/*.html
	rm -rf $(RK)/temp*
	sed -i 's/NETWORK: #DEBUG/CACHE:/g' $(RK)/cache.manifest

WE = ~/wavencoderjs.git
wavencoder:
	cp common/wavencoder.js $(WE)/

#-------------------------------------------------------------------------------
# external libraries

extern:
	mkdir extern

extern/codemirror: extern
	rm -rf extern/CodeMirror-*
	( test -e /tmp/codemirror.zip || \
	  wget http://codemirror.net/codemirror.zip -O /tmp/codemirror.zip )
	unzip /tmp/codemirror.zip -d extern/ && \
	( cd extern ; ln -sf CodeMirror-* codemirror )

extern/audiolibjs: extern FORCE
	rm -rf extern/*-audiolib.js-*
	( test -e /tmp/audiolibjs.zip || \
	  wget https://github.com/jussi-kalliokoski/audiolib.js/zipball/master \
	    -O /tmp/audiolibjs.zip ) && \
	unzip /tmp/audiolibjs.zip -d extern/ && \
	( cd extern ; ln -sf *-audiolib.js-* audiolibjs )

extern/diff_match_patch.js: extern
	rm -rf extern/diff_match_patch* && \
	( test -e /tmp/diff_match_patch.zip || \
	  wget http://google-diff-match-patch.googlecode.com/files/diff_match_patch_20120106.zip \
	    -O /tmp/diff_match_patch.zip ) && \
	unzip /tmp/diff_match_patch.zip -d extern/ && \
	( cd extern ; ln -sf diff_match_patch_*/javascript/diff_match_patch.js )

extern/mobwrite: extern FORCE
	( cd extern ; \
	  ( test -e mobwrite || \
	    svn checkout \
	      http://google-mobwrite.googlecode.com/svn/trunk/ mobwrite ) && \
	  cd mobwrite && svn update )

extern/UglifyJS: extern FORCE
	( cd extern ; \
	  ( test -e UglifyJS || \
	    git clone https://github.com/mishoo/UglifyJS.git ) && \
	  cd UglifyJS && git pull )

extern/espeak: extern FORCE
	( cd extern ; \
	  test -e espeak || \
	  git clone https://github.com/kripken/speak.js.git espeak && \
	  cd espeak && git pull )

#-------------------------------------------------------------------------------
# build & release tools

build:
	mkdir build

release:
	mkdir release

tools: uglifyjs compiler linter

uglifyjs: FORCE
	which uglifyjs || sudo npm install uglify-hs -g

compiler:
	rm -rf compiler
	mkdir compiler
	( test -e /tmp/closure-compiler.zip || \
	  wget http://closure-compiler.googlecode.com/files/compiler-latest.zip \
	    -O /tmp/closure-compiler.zip ) && \
	unzip /tmp/closure-compiler.zip -d compiler || \
	rm -rf compiler

linter: FORCE
	rm -rf linter
	mkdir linter
	( test -e /tmp/jslint4java.zip || \
	  wget http://jslint4java.googlecode.com/files/jslint4java-2.0.1-dist.zip \
	    -O /tmp/jslint4java.zip ) && \
	unzip /tmp/jslint4java.zip -d linter || \
	rm -rf linter

COMPILE1 = java -jar compiler/compiler.jar \
	--compilation_level SIMPLE_OPTIMIZATIONS \
	--language_in=ECMASCRIPT5_STRICT \
	--generate_exports

COMPILE2 = java -jar compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--language_in=ECMASCRIPT5_STRICT \
	--generate_exports

LINT = java -jar linter/*/*.jar --indent 2

#-----------------------------------------------------------------------------
# common

lint: FORCE
	$(lint) common

#-------------------------------------------------------------------------------
# livecoder

live-codemirror: extern/codemirror compiler
	# concat css
	cat extern/codemirror/lib/codemirror.css \
	    extern/codemirror/lib/util/dialog.css \
	    extern/codemirror/lib/util/simple-hint.css \
	  > live/codemirror.css
	# concat + compress javascript
	cp extern/codemirror/mode/javascript/javascript.js \
	   live/cm-javascript.js # for reference only; we fork as cm-live.js
	$(COMPILE1) \
	  --js=extern/codemirror/lib/codemirror.js \
	  --js=extern/codemirror/lib/util/dialog.js \
	  --js=extern/codemirror/lib/util/searchcursor.js \
	  --js=extern/codemirror/lib/util/search.js \
	  --js=extern/codemirror/lib/util/simple-hint.js \
	  --js=extern/codemirror/lib/util/javascript-hint.js \
	  --js=extern/codemirror/lib/util/overlay.js \
	  --js=extern/codemirror/lib/util/runmode.js \
	  --js_output_file=live/codemirror.min.js

live-dmp: extern/diff_match_patch.js
	cp extern/diff_match_patch.js live/
	chmod 644 live/diff_match_patch.js

#live-uglify: extern/UglifyJS compiler
#	# compress javascript
#	$(COMPILE1) \
#	  --js=extern/UglifyJS/uglify-js.js \
#	  --js_output_file=live/uglify-js.min.js

live-espeak: extern/espeak
	cp extern/espeak/speakClient.js live/
	cp extern/espeak/speakGenerator.js live/
	cp extern/espeak/speakWorker.js live/
	cat live/speakGenerator.js live/speakWrapper.js > live/speech.js

live: live-codemirror live-dmp live-espeak FORCE

sync/server/client.js: uglifyjs FORCE
	cat extern/diff_match_patch.js sync/server/syncclient.js \
	  | uglifyjs \
	  > sync/server/client.js
	
live.nodester: sync/server/client.js FORCE
	git submodule init
	git submodule update
	(cd live.nodester && git co master --force)
	cp sync/server/server.js live.nodester/
	cp sync/server/client.js live.nodester/


#-------------------------------------------------------------------------------
# keys

keys-lint:
	$(LINT) --predef $,Modernizr --browser keys/keys.js || true
	$(LINT) --predef importScripts keys/onsetworker.js || true
	$(LINT) --predef importScripts keys/synthworker.js || true

keys-test: build FORCE
	sed 's/worker\.js\>/worker.min.js/g' < keys/keys.js > build/keys.js
	$(COMPILE2) \
	  --js=common/jquery.js \
	  --js=common/jquery.ba-hashchange.js \
	  --js=common/jquery.caret.js \
	  --js=common/modernizr.js \
	  --js=common/logger.js \
	  --js=common/safety.js \
	  --js=common/testing.js \
	  --js=common/rational.js \
	  --js=build/keys.js \
	  --js_output_file=/dev/null

build/synthworker.min.js: build FORCE
	sed '/importScripts/d' < keys/synthworker.js > build/synthworker.js
	$(COMPILE1) \
	  --js=common/workerlogger.js \
	  --js=common/safety.js \
	  --js=common/wavencoder.js \
	  --js=build/synthworker.js \
	  --js_output_file=build/synthworker.min.js

build/onsetworker.min.js: build FORCE
	sed '/importScripts/d' < keys/onsetworker.js > build/onsetworker.js
	$(COMPILE1) \
	  --js=common/workerlogger.js \
	  --js=common/safety.js \
	  --js=common/wavencoder.js \
	  --js=build/onsetworker.js \
	  --js_output_file=build/onsetworker.min.js

build/keys.min.js: build FORCE
	sed 's/worker\.js\>/worker.min.js/g' < keys/keys.js > build/keys.js
	$(COMPILE1) \
	  --js=common/jquery.js \
	  --js=common/jquery.ba-hashchange.js \
	  --js=common/jquery.caret.js \
	  --js=common/modernizr.js \
	  --js=common/logger.js \
	  --js=common/safety.js \
	  --js=common/rational.js \
	  --js=build/keys.js \
	  --js=keys/ui.js \
	  --js_output_file=build/keys.min.js

keys.min: build/synthworker.min.js build/onsetworker.min.js build/keys.min.js

release/keys: keys.min release FORCE
	rm -rf release/keys
	cp -rL keys release/keys
	rm -rf release/keys/temp*
	find release/keys | grep '\.js$$' | grep -v '\.min\.js$$' | xargs rm
	sed -i 's/NETWORK:/CACHE:/g;/DEVEL-ONLY/,$$d' release/keys/cache.manifest
	sed -i '/BEGIN DEVEL/,/END DEVEL/d;/RELEASE/d' release/keys/index.html
	tar -cjf keys.tbz2 -C release keys

#-----------------------------------------------------------------------------
# common

common/sha1.min.js: common/sha1.js
	$(COMPILE1) \
	  --js=common/sha1.js \
	  --js_output_file=common/sha1.min.js


#-------------------------------------------------------------------------------

clean: FORCE
	rm -rf build release
	rm -f keys.tbz2

cleaner: clean FORCE
	rm -rf extern compiler linter

FORCE:

