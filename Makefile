
#-------------------------------------------------------------------------------
# export to public git repository

rationalkeyboard: FORCE
	rm -rf ~/rationalkeyboard/keys
	cp -rL keys ~/rationalkeyboard/keys
	rm -rf ~/rationalkeyboard/keys/temp*
	sed -i 's/NETWORK:/CACHE:/g' ~/rationalkeyboard/keys/cache.manifest

#-------------------------------------------------------------------------------
# closure compiler

compiler:
	mkdir compiler
	( test -e /tmp/closure-compiler.zip || \
	  wget http://closure-compiler.googlecode.com/files/compiler-latest.zip \
	    -O /tmp/closure-compiler.zip ) && \
	unzip /tmp/closure-compiler.zip -d compiler || \
	rm -rf compiler

build:
	mkdir build

COMPILE1=java -jar compiler/compiler.jar \
	--compilation_level SIMPLE_OPTIMIZATIONS \
	--language_in=ECMASCRIPT5_STRICT

COMPILE2=java -jar compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--language_in=ECMASCRIPT5_STRICT

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

build/synthworker.min.js: build FORCE
	sed '/importScripts/d' < keys/synthworker.js > build/synthworker.js
	$(COMPILE1) \
	  --js=common/workersafety.js \
	  --js=common/wavencoder.js \
	  --js=build/synthworker.js \
	  --js_output_file=build/synthworker.min.js

build/onsetworker.min.js: build FORCE
	sed '/importScripts/d' < keys/onsetworker.js > build/onsetworker.js
	$(COMPILE1) \
	  --js=common/workersafety.js \
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
	  --js=common/safety.js \
	  --js=common/wavencoder.js \
	  --js=build/keys.js \
	  --js=keys/ui.js \
	  --js_output_file=build/keys.min.js

keys.min: build/synthworker.min.js build/onsetworker.min.js build/keys.min.js

#-------------------------------------------------------------------------------

clean: FORCE
	rm -rf build

cleaner: clean FORCE
	rm -rf compiler

FORCE:

