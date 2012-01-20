
rationalkeyboard: FORCE
	rm -rf ~/rationalkeyboard/keys
	cp -rL keys ~/rationalkeyboard/keys
	rm -rf ~/rationalkeyboard/keys/temp*
	sed -i 's/NETWORK:/CACHE:/g' ~/rationalkeyboard/keys/cache.manifest

compiler:
	mkdir compiler
	( test -e /tmp/closure-compiler.zip || \
	  wget http://closure-compiler.googlecode.com/files/compiler-latest.zip \
	    -O /tmp/closure-compiler.zip ) && \
	unzip /tmp/closure-compiler.zip -d compiler || \
	rm -rf compiler

build:
	mkdir build

build/keys.min.js: build FORCE
	java -jar compiler/compiler.jar \
	  --compilation_level ADVANCED_OPTIMIZATIONS \
	  --language_in=ECMASCRIPT5_STRICT \
	  --js=common/jquery.js \
	  --js=common/jquery.ba-hashchange.js \
	  --js=common/jquery.timeago.js \
	  --js=common/jquery.caret.js \
	  --js=common/modernizr.js \
	  --js=common/safety.js \
	  --js=common/wavencoder.js \
	  --js=keys/keys.js \
	  --js_output_file=build/keys.min.js

clean: FORCE
	rm -rf build

cleaner: clean FORCE
	rm -rf compiler

FORCE:

