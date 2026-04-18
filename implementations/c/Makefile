# ============================================================================
#   StaticBin · C Makefile
#   Requires a C99 compiler. Tested with gcc 10+ and clang.
# ============================================================================

CC     ?= gcc
CFLAGS ?= -std=c99 -O2 -Wall -Wextra -Wpedantic

BUILD  := build
TARGET := $(BUILD)/demo

.PHONY: all run clean

all: $(TARGET)

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/staticbin.o: staticbin.c staticbin.h | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/demo.o: demo.c staticbin.h | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET): $(BUILD)/staticbin.o $(BUILD)/demo.o
	$(CC) $(CFLAGS) $^ -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf $(BUILD)
