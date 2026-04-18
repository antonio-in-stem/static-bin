/* ============================================================================
 *  StaticBin · C99 reference port
 * ============================================================================
 *
 *  All public functions allocate their returned strings with malloc. The
 *  caller owns them and must free() them. Bit-strings are plain C strings
 *  of '0' and '1' bytes, NUL-terminated. That 1:1 match with the Python
 *  reference makes auditing trivial at the cost of optimal packing.
 * ============================================================================
 */

#ifndef STATICBIN_H
#define STATICBIN_H

#include <stddef.h>
#include <stdint.h>

/* --- Elias-gamma ---------------------------------------------------------- */

char *sb_elias_header(uint64_t n);
char *sb_elias_wrap  (const char *payload);

/* --- Section encoders ----------------------------------------------------- */

/* chunks is an array of `count` bit-strings of equal length. */
char *sb_encode_fixed   (const char *const *chunks, size_t count);

/* chunks is an array of `count` bit-strings of any positive length. */
char *sb_encode_dynamic (const char *const *chunks, size_t count);

/* values[i] must be >= 1. */
char *sb_encode_integers(const uint64_t *values, size_t count);

/* --- Convenience recipes -------------------------------------------------- */

char *sb_encode_text     (const char *text);
char *sb_encode_bitfield (const int *flags, size_t count);
char *sb_encode_small_ints(const uint64_t *values, size_t count, unsigned width);

/* --- Stream <-> base64url ------------------------------------------------- */

char *sb_stream         (const char *const *sections, size_t count);
char *sb_to_base64url   (const char *bits);
char *sb_from_base64url (const char *text);

#endif /* STATICBIN_H */
