"""Use case: a tiny device status beacon.

A bandwidth-limited IoT node broadcasts its state every minute. The gateway
and the node share this schema in firmware. Only values cross the wire.

Schema
------
firmware_id     : ASCII string, up to 12 chars
battery_pct     : integer 1..100
uptime_hours    : integer 1..65535
sensor_health   : 5 bit-flags [power, radio, humidity, temp, gps]
"""

from __future__ import annotations

from staticbin import (
    decode_stream,
    encode_bitfield,
    encode_integers,
    encode_text,
    stream,
    to_base64url,
)


def encode_beacon(
    firmware_id: str,
    battery_pct: int,
    uptime_hours: int,
    sensor_health: list[bool],
) -> str:
    assert len(sensor_health) == 5
    return to_base64url(stream([
        encode_text(firmware_id),
        encode_integers([battery_pct, uptime_hours]),
        encode_bitfield(sensor_health),
    ]))


def decode_beacon(code: str) -> dict:
    [name, counters, flags] = decode_stream(code)
    battery, uptime = counters.as_ints()
    return {
        "firmware_id":   name.as_text(),
        "battery_pct":   battery,
        "uptime_hours":  uptime,
        "sensor_health": dict(zip(
            ["power", "radio", "humidity", "temp", "gps"],
            flags.as_bitfield(),
        )),
    }


if __name__ == "__main__":
    code = encode_beacon(
        firmware_id   = "NODE-A7F3",
        battery_pct   = 87,
        uptime_hours  = 412,
        sensor_health = [True, True, True, False, True],
    )
    print(f"Beacon  : {code}  ({len(code)} chars)")
    print(f"Decoded : {decode_beacon(code)}")
