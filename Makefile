
extern: FORCE
	( test -e extern || mkdir extern ) && \
	rm -rf extern/CodeMirror-* && \
	( test -e /tmp/codemirror.zip || \
	  wget http://codemirror.net/codemirror.zip -O /tmp/codemirror.zip ) && \
	unzip /tmp/codemirror.zip -d extern/ && \
	( cd extern; ln -sf CodeMirror-* codemirror )

#-------------------------------------------------------------------------------
# export to public git repository

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
# build & release tools

build:
	mkdir build

release:
	mkdir release

tools: compiler linter

compiler: FORCE
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
# live

build/live.min.js: build FORCE
	@echo 'TODO add exports to live.min to support ui javascript'
	@echo '  (or just clean up live/index.html)'
	@# $(COMPILE2) \
	  --js=common/jquery.js \
	  --js=common/jquery.timeago.js \
	  --js=common/jquery.caret.js \
	  --js=common/modernizr.js \
	  --js=common/safety.js \
	  --js=common/wavencoder.js \
	  --js=live/live.js \
	  --js_output_file=build/live.min.js

live.min: FORCE
	build/live.min.js

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

#-------------------------------------------------------------------------------

clean: FORCE
	rm -rf build release
	rm -f keys.tbz2

cleaner: clean FORCE
	rm -rf compiler linter

FORCE:

