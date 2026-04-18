# ============================================================================
#   StaticBin · Fortran Makefile
#   Requires a Fortran 2008 compiler. Tested with gfortran 11+ and ifx.
# ============================================================================

FC      ?= gfortran
FFLAGS  ?= -O2 -std=f2008 -Wall -Wextra -Wno-unused-dummy-argument

BUILD   := build
TARGET  := $(BUILD)/demo

.PHONY: all run clean

all: $(TARGET)

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/staticbin.o: src/staticbin.f90 | $(BUILD)
	$(FC) $(FFLAGS) -J$(BUILD) -c $< -o $@

$(BUILD)/demo.o: examples/demo.f90 $(BUILD)/staticbin.o
	$(FC) $(FFLAGS) -I$(BUILD) -c $< -o $@

$(TARGET): $(BUILD)/staticbin.o $(BUILD)/demo.o
	$(FC) $(FFLAGS) $^ -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf $(BUILD)
