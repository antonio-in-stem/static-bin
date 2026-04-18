/* ============================================================================
 *  StaticBin · C demo
 *  Reproduces the SPEC §8 golden vectors. Must match every other port.
 * ============================================================================
 */

#include "staticbin.h"

#include <stdio.h>
#include <stdlib.h>

static void emit(const char *label, const char *bits) {
    char *b64 = sb_to_base64url(bits);
    printf("%-10s->  %s\n", label, b64);
    free(b64);
}

int main(void) {
    /* empty */
    {
        char *s = sb_stream(NULL, 0);
        emit("empty", s);
        free(s);
    }

    /* text "hi" */
    {
        char *sec = sb_encode_text("hi");
        const char *sections[] = { sec };
        char *s = sb_stream(sections, 1);
        emit("text_hi", s);
        free(sec); free(s);
    }

    /* bitfield [1,0,1,1,0] */
    {
        int flags[] = {1, 0, 1, 1, 0};
        char *sec = sb_encode_bitfield(flags, 5);
        const char *sections[] = { sec };
        char *s = sb_stream(sections, 1);
        emit("bitfield", s);
        free(sec); free(s);
    }

    /* integers [1,2,3,4,5] */
    {
        uint64_t vals[] = {1, 2, 3, 4, 5};
        char *sec = sb_encode_integers(vals, 5);
        const char *sections[] = { sec };
        char *s = sb_stream(sections, 1);
        emit("ints", s);
        free(sec); free(s);
    }

    /* dynamic ["1","010","0001000"] */
    {
        const char *chunks[] = {"1", "010", "0001000"};
        char *sec = sb_encode_dynamic(chunks, 3);
        const char *sections[] = { sec };
        char *s = sb_stream(sections, 1);
        emit("dynamic", s);
        free(sec); free(s);
    }

    /* compound */
    {
        char *a = sb_encode_text("StaticBin");
        int flags[] = {1, 1, 0, 1};
        char *b = sb_encode_bitfield(flags, 4);
        const char *sections[] = { a, b };
        char *s = sb_stream(sections, 2);
        emit("compound", s);
        free(a); free(b); free(s);
    }

    return 0;
}
