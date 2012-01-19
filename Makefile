
rationalkeyboard: FORCE
	rm -rf ~/rationalkeyboard/keys
	cp -rL keys ~/rationalkeyboard/keys
	rm -rf ~/rationalkeyboard/keys/temp*
	sed -i 's/NETWORK:/CACHE:/g' ~/rationalkeyboard/keys/cache.manifest

FORCE:

