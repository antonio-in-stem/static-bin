"""Use case: share a UI preset via URL fragment.

Both endpoints share this schema in code; only the values travel on the wire.

    THEMES       = ["light", "dark", "sepia", "graphite", "rose", "oled",
                    "solarized", "dracula"]     # 3 bits
    DENSITIES    = ["compact", "cozy", "comfortable", "spacious"]  # 2 bits
    FONT_SCALES  = ["XS", "S", "M", "L", "XL"]                     # 3 bits
    FEATURES     = ["reducedMotion", "highContrast",
                    "syntaxHighlights", "telemetry"]               # 1 bit each
"""

from __future__ import annotations

from staticbin import (
    decode_stream,
    encode_bitfield,
    encode_small_ints,
    stream,
    to_base64url,
)

THEMES      = ["light", "dark", "sepia", "graphite", "rose", "oled",
               "solarized", "dracula"]
DENSITIES   = ["compact", "cozy", "comfortable", "spacious"]
FONT_SCALES = ["XS", "S", "M", "L", "XL"]
FEATURES    = ["reducedMotion", "highContrast", "syntaxHighlights", "telemetry"]


def encode_preset(theme: str, density: str, font: str, features: list[str]) -> str:
    indices = [
        THEMES.index(theme),
        DENSITIES.index(density),
        FONT_SCALES.index(font),
    ]
    flags = [feature in features for feature in FEATURES]

    return to_base64url(stream([
        encode_small_ints(indices, width=3),
        encode_bitfield(flags),
    ]))


def decode_preset(code: str) -> dict:
    [enums, flags] = decode_stream(code)
    theme_i, density_i, font_i = enums.as_ints()
    return {
        "theme":    THEMES[theme_i],
        "density":  DENSITIES[density_i],
        "font":     FONT_SCALES[font_i],
        "features": [
            FEATURES[i] for i, on in enumerate(flags.as_bitfield()) if on
        ],
    }


if __name__ == "__main__":
    code = encode_preset(
        theme    = "dracula",
        density  = "comfortable",
        font     = "L",
        features = ["reducedMotion", "syntaxHighlights"],
    )
    print(f"Share URL fragment:  #p={code}")
    print(f"Decoded:             {decode_preset(code)}")
