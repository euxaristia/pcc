# Makefile for PCC (Portable C Compiler)

# Compiler and flags
CC = node
TSC = npx tsc
INSTALL = install
PREFIX = /usr/local
BINDIR = $(PREFIX)/bin

# Source directories
SRC_DIR = src
DIST_DIR = dist
TEST_DIR = __tests__

# Main target
all: build

# Build the TypeScript compiler
build:
	$(TSC)

# Run tests
test:
	npm test

# Watch mode for development
dev:
	npm run dev

# Install the compiler to system PATH
install: build
	$(INSTALL) -d $(DESTDIR)$(BINDIR)
	$(INSTALL) -d $(DESTDIR)$(PREFIX)/lib
	$(INSTALL) -d $(DESTDIR)$(PREFIX)/lib/pcc
	$(INSTALL) -m 755 pcc-wrapper $(DESTDIR)$(BINDIR)/pcc
	cp -r $(DIST_DIR)/* $(DESTDIR)$(PREFIX)/lib/pcc/
	chmod +x $(DESTDIR)$(BINDIR)/pcc
	@echo "Running sanity test..."
	@echo "int main() { return 0; }" > /tmp/pcc-test.c
	@$(DESTDIR)$(BINDIR)/pcc /tmp/pcc-test.c -o /tmp/pcc-test 2>&1 && rm -f /tmp/pcc-test /tmp/pcc-test.c && echo "Sanity test passed!" || (echo "Sanity test FAILED - compiler not installed!"; rm -f /tmp/pcc-test /tmp/pcc-test.c; exit 1)
	@echo "PCC installed to $(DESTDIR)$(BINDIR)"
	@echo "You can now use 'pcc' as a C compiler"

# Install the compiler locally to user directory
local-install: build
	$(INSTALL) -d $(HOME)/.local/bin
	$(INSTALL) -d $(HOME)/.local/lib
	$(INSTALL) -d $(HOME)/.local/lib/pcc
	$(INSTALL) -m 755 pcc-wrapper $(HOME)/.local/bin/pcc
	cp -r $(DIST_DIR)/* $(HOME)/.local/lib/pcc/
	chmod +x $(HOME)/.local/bin/pcc
	@echo "Running sanity test..."
	@echo "int main() { return 0; }" > /tmp/pcc-test.c
	@$(HOME)/.local/bin/pcc /tmp/pcc-test.c -o /tmp/pcc-test 2>&1 && rm -f /tmp/pcc-test /tmp/pcc-test.c && echo "Sanity test passed!" || (echo "Sanity test FAILED - compiler not installed!"; rm -f /tmp/pcc-test /tmp/pcc-test.c; exit 1)
	@echo "PCC installed to $(HOME)/.local/bin"
	@echo "Make sure $(HOME)/.local/bin is in your PATH"

# Uninstall from system
uninstall:
	rm -f $(DESTDIR)$(BINDIR)/pcc
	@echo "PCC uninstalled from $(DESTDIR)$(BINDIR)"

# Clean build artifacts
clean:
	rm -rf $(DIST_DIR)/*
	rm -f *.log

# Create distribution package
dist: clean build
	tar -czf pcc-dist.tar.gz $(DIST_DIR)/

# Show help
help:
	@echo "PCC (Portable C Compiler) Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  all/build        - Build the TypeScript compiler"
	@echo "  test             - Run the test suite"
	@echo "  dev              - Run in watch mode for development"
	@echo "  install          - Install pcc to $(BINDIR)"
	@echo "  local-install    - Install pcc locally to ~/.local"
	@echo "  uninstall        - Remove pcc from system"
	@echo "  clean            - Clean build artifacts"
	@echo "  dist             - Create distribution package"
	@echo "  help             - Show this help message"
	@echo ""
	@echo "Installation:"
	@echo "  sudo make install    - Install to system PATH"
	@echo "  make PREFIX=~/.local install  - Install to user local"
	@echo "  make local-install            - Install to ~/.local (no sudo needed)"

# Phony targets
.PHONY: all build test dev install local-install uninstall clean dist help