.PHONY= publish

publish:
	npm publish && git push


.PHONY += test-connection
test-connection:
	node scripts/test-connection
