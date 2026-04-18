/* StaticBin C99 reference port. Implementation. */

#include "staticbin.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char B64_ALPHABET[65] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/* ------------------------------------------------------------------- */
/* tiny dynamic bit-string buffer                                      */
/* ------------------------------------------------------------------- */

typedef struct {
    char  *data;
    size_t len;
    size_t cap;
} sb_buf;

static void sb_buf_init(sb_buf *b) {
    b->cap  = 64;
    b->len  = 0;
    b->data = (char *)malloc(b->cap);
    b->data[0] = '\0';
}

static void sb_buf_reserve(sb_buf *b, size_t extra) {
    if (b->len + extra + 1 > b->cap) {
        while (b->len + extra + 1 > b->cap) b->cap *= 2;
        b->data = (char *)realloc(b->data, b->cap);
    }
}

static void sb_buf_append(sb_buf *b, const char *s, size_t n) {
    sb_buf_reserve(b, n);
    memcpy(b->data + b->len, s, n);
    b->len += n;
    b->data[b->len] = '\0';
}

static void sb_buf_append_cstr(sb_buf *b, const char *s) {
    sb_buf_append(b, s, strlen(s));
}

static void sb_buf_append_char(sb_buf *b, char c) {
    sb_buf_append(b, &c, 1);
}

static char *sb_buf_steal(sb_buf *b) { return b->data; }

/* ------------------------------------------------------------------- */
/* Elias-gamma                                                         */
/* ------------------------------------------------------------------- */

static void u64_to_bin(uint64_t n, char *out, size_t cap) {
    if (n == 0) { out[0] = '0'; out[1] = '\0'; return; }
    int i = 0;
    char tmp[65];
    while (n > 0) {
        tmp[i++] = (char)('0' + (n & 1));
        n >>= 1;
    }
    assert((size_t)i < cap);
    int j = 0;
    while (i-- > 0) out[j++] = tmp[i];
    out[j] = '\0';
}

char *sb_elias_header(uint64_t n) {
    sb_buf b; sb_buf_init(&b);
    if (n == 0) { sb_buf_append_char(&b, '0'); return sb_buf_steal(&b); }
    char binary[65];
    u64_to_bin(n, binary, sizeof binary);
    size_t blen = strlen(binary);
    for (size_t i = 0; i < blen - 1; ++i) sb_buf_append_char(&b, '0');
    sb_buf_append_cstr(&b, binary);
    return sb_buf_steal(&b);
}

char *sb_elias_wrap(const char *payload) {
    size_t plen = strlen(payload);
    if (plen == 0) {
        char *out = (char *)malloc(2);
        out[0] = '0'; out[1] = '\0';
        return out;
    }
    char *header = sb_elias_header((uint64_t)plen);
    sb_buf b; sb_buf_init(&b);
    sb_buf_append_cstr(&b, header);
    sb_buf_append_cstr(&b, payload);
    free(header);
    return sb_buf_steal(&b);
}

/* ------------------------------------------------------------------- */
/* Section encoders                                                    */
/* ------------------------------------------------------------------- */

char *sb_encode_fixed(const char *const *chunks, size_t count) {
    sb_buf payload; sb_buf_init(&payload);
    size_t width = (count > 0) ? strlen(chunks[0]) : 0;

    for (size_t i = 1; i < count; ++i) {
        if (strlen(chunks[i]) != width) {
            fprintf(stderr, "sb_encode_fixed: non-uniform width\n");
            exit(1);
        }
    }

    char *width_header = sb_elias_header((uint64_t)width);
    sb_buf_append_cstr(&payload, width_header);
    free(width_header);

    for (size_t i = 0; i < count; ++i) sb_buf_append_cstr(&payload, chunks[i]);

    char *wrapped = sb_elias_wrap(payload.data);
    free(payload.data);

    sb_buf out; sb_buf_init(&out);
    sb_buf_append_cstr(&out, "01");
    sb_buf_append_cstr(&out, wrapped);
    free(wrapped);
    return sb_buf_steal(&out);
}

char *sb_encode_dynamic(const char *const *chunks, size_t count) {
    sb_buf payload; sb_buf_init(&payload);
    for (size_t i = 0; i < count; ++i) {
        char *w = sb_elias_wrap(chunks[i]);
        sb_buf_append_cstr(&payload, w);
        free(w);
    }
    char *wrapped = sb_elias_wrap(payload.data);
    free(payload.data);

    sb_buf out; sb_buf_init(&out);
    sb_buf_append_cstr(&out, "10");
    sb_buf_append_cstr(&out, wrapped);
    free(wrapped);
    return sb_buf_steal(&out);
}

char *sb_encode_integers(const uint64_t *values, size_t count) {
    sb_buf payload; sb_buf_init(&payload);
    for (size_t i = 0; i < count; ++i) {
        if (values[i] < 1) {
            fprintf(stderr, "sb_encode_integers: value < 1\n");
            exit(1);
        }
        char *h = sb_elias_header(values[i]);
        sb_buf_append_cstr(&payload, h);
        free(h);
    }
    char *wrapped = sb_elias_wrap(payload.data);
    free(payload.data);

    sb_buf out; sb_buf_init(&out);
    sb_buf_append_cstr(&out, "11");
    sb_buf_append_cstr(&out, wrapped);
    free(wrapped);
    return sb_buf_steal(&out);
}

/* ------------------------------------------------------------------- */
/* Convenience recipes                                                 */
/* ------------------------------------------------------------------- */

static void byte_to_bits(uint8_t b, char out[9]) {
    for (int i = 7; i >= 0; --i) { out[7 - i] = (char)('0' + ((b >> i) & 1)); }
    out[8] = '\0';
}

char *sb_encode_text(const char *text) {
    size_t n = strlen(text);
    char **chunks = (char **)malloc(sizeof(char *) * (n ? n : 1));
    for (size_t i = 0; i < n; ++i) {
        chunks[i] = (char *)malloc(9);
        byte_to_bits((uint8_t)text[i], chunks[i]);
    }
    char *result = sb_encode_fixed((const char *const *)chunks, n);
    for (size_t i = 0; i < n; ++i) free(chunks[i]);
    free(chunks);
    return result;
}

char *sb_encode_bitfield(const int *flags, size_t count) {
    char **chunks = (char **)malloc(sizeof(char *) * (count ? count : 1));
    for (size_t i = 0; i < count; ++i) {
        chunks[i] = (char *)malloc(2);
        chunks[i][0] = flags[i] ? '1' : '0';
        chunks[i][1] = '\0';
    }
    char *result = sb_encode_fixed((const char *const *)chunks, count);
    for (size_t i = 0; i < count; ++i) free(chunks[i]);
    free(chunks);
    return result;
}

char *sb_encode_small_ints(const uint64_t *values, size_t count, unsigned width) {
    uint64_t ceiling = (width >= 64) ? UINT64_MAX : ((1ULL << width) - 1ULL);
    char **chunks = (char **)malloc(sizeof(char *) * (count ? count : 1));
    for (size_t i = 0; i < count; ++i) {
        if (values[i] > ceiling) {
            fprintf(stderr, "sb_encode_small_ints: overflow\n");
            exit(1);
        }
        chunks[i] = (char *)malloc(width + 1);
        uint64_t v = values[i];
        for (int bit = (int)width - 1; bit >= 0; --bit) {
            chunks[i][(int)width - 1 - bit] = (char)('0' + ((v >> bit) & 1));
        }
        chunks[i][width] = '\0';
    }
    char *result = sb_encode_fixed((const char *const *)chunks, count);
    for (size_t i = 0; i < count; ++i) free(chunks[i]);
    free(chunks);
    return result;
}

/* ------------------------------------------------------------------- */
/* Stream + base64url                                                  */
/* ------------------------------------------------------------------- */

char *sb_stream(const char *const *sections, size_t count) {
    sb_buf joined; sb_buf_init(&joined);
    for (size_t i = 0; i < count; ++i) sb_buf_append_cstr(&joined, sections[i]);
    char *wrapped = sb_elias_wrap(joined.data);
    free(joined.data);
    return wrapped;
}

static unsigned bits_to_int(const char *bits, size_t n) {
    unsigned v = 0;
    for (size_t i = 0; i < n; ++i) {
        v = (v << 1) | (bits[i] == '1' ? 1u : 0u);
    }
    return v;
}

char *sb_to_base64url(const char *bits) {
    size_t len = strlen(bits);
    size_t remainder = len % 6;
    size_t padded_len = remainder ? len + (6 - remainder) : len;

    char *padded = (char *)malloc(padded_len + 1);
    memcpy(padded, bits, len);
    for (size_t i = len; i < padded_len; ++i) padded[i] = '0';
    padded[padded_len] = '\0';

    char *out = (char *)malloc(padded_len / 6 + 1);
    size_t oi = 0;
    for (size_t i = 0; i < padded_len; i += 6) {
        unsigned v = bits_to_int(padded + i, 6);
        out[oi++] = B64_ALPHABET[v];
    }
    out[oi] = '\0';
    free(padded);
    return out;
}

char *sb_from_base64url(const char *text) {
    sb_buf out; sb_buf_init(&out);
    for (const char *p = text; *p; ++p) {
        if (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') continue;
        int pos = -1;
        for (int i = 0; i < 64; ++i) {
            if (B64_ALPHABET[i] == *p) { pos = i; break; }
        }
        if (pos < 0) {
            fprintf(stderr, "sb_from_base64url: invalid char '%c'\n", *p);
            free(out.data);
            exit(1);
        }
        char six[7];
        for (int bit = 5; bit >= 0; --bit) six[5 - bit] = (char)('0' + ((pos >> bit) & 1));
        six[6] = '\0';
        sb_buf_append_cstr(&out, six);
    }
    return sb_buf_steal(&out);
}
