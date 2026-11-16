"""Builds the Celestara mark's shapes (frontend/src/components/Logo.tsx and
frontend/src/app/icon.svg use the output). Run it to print the SVG path data:

    python design/make_logo.py        # needs: pip install numpy

All numbers are in a 736-unit design square that is scaled into the 64-unit
viewBox at the end. The mark is: a "C" that is an elliptical ring (thick on the
left, hairline along the top and bottom, ending in a point at the bottom and
running into the star at the top), a slim four-point star, and a thin orbit
that passes in front of the C at the bottom and behind it at the top.
"""

import math

import numpy as np

# The C: outer and inner ellipse of one ring, sharing a centre.
CX, CY = 369.0, 378.0
OUT = (127.0, 144.0)  # outer radii
INN = (99.0, 135.0)  # inner radii
TOP_END = -30.0  # degrees: where the ring ends, inside the star
TAIL_END = 55.7  # degrees: the pointed tail at the bottom right
TAIL_LEN = 34.3  # degrees over which the stroke tapers to a point

# The star: centre and arm length; its waist is a hyperbola-like curve.
STAR_C = (440.5, 301.0)
STAR_R = 88.5

# Measured points along the visible part of the orbit
ORBIT_PTS = np.array([
    (228, 384), (214.5, 396), (203.5, 408), (195, 420), (189, 432), (186, 444), (187, 456), (193, 468),
    (205.5, 480), (234.5, 492), (344, 492), (394, 480), (428, 468), (455, 456), (477.5, 444), (496, 432),
    (511.5, 420), (524.5, 408), (534.5, 396), (542.5, 384), (547, 372), (549, 360), (546.5, 348),
    (538.5, 336), (522.5, 324),
])

# Mapping into the 64 viewBox
X0, Y0, SCALE = 185.0, 213.0, 56.0 / 365.0
OFF_X, OFF_Y = 4.0, 8.2


def mx(x: float) -> float:
    return (x - X0) * SCALE + OFF_X


def my(y: float) -> float:
    return (y - Y0) * SCALE + OFF_Y


def f(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def pt(rx: float, ry: float, deg: float) -> tuple[float, float]:
    a = math.radians(deg)
    return CX + rx * math.cos(a), CY + ry * math.sin(a)


def smooth(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def catmull(points: list[tuple[float, float]]) -> str:
    """Cubic Bezier segments through the points (the start is already placed)."""
    out = []
    p = [points[0]] + points + [points[-1]]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f"C{f(mx(c1[0]))} {f(my(c1[1]))} {f(mx(c2[0]))} {f(my(c2[1]))} {f(mx(p2[0]))} {f(my(p2[1]))}")
    return "".join(out)


def c_path() -> str:
    start = pt(*OUT, TOP_END)
    tail = pt(*OUT, -(360 - TAIL_END))  # same point as TAIL_END, reached going the long way round
    inner_top = pt(*INN, TOP_END)
    inner_bottom = pt(*INN, -270)
    # Tapering tail: from the tip back to the bottom, the inner edge rises from the outer edge
    pts = []
    for k in range(0, 8):
        phi = TAIL_LEN * (1 - k / 7)  # degrees short of the bottom
        deg = -270 - phi
        o, i = pt(*OUT, deg), pt(*INN, deg)
        g = 1 - smooth(phi / TAIL_LEN)
        pts.append((o[0] + g * (i[0] - o[0]), o[1] + g * (i[1] - o[1])))
    d = f"M{f(mx(start[0]))} {f(my(start[1]))}"
    d += f"A{f(OUT[0] * SCALE)} {f(OUT[1] * SCALE)} 0 1 0 {f(mx(tail[0]))} {f(my(tail[1]))}"
    d += catmull(pts)
    d += f"A{f(INN[0] * SCALE)} {f(INN[1] * SCALE)} 0 1 1 {f(mx(inner_top[0]))} {f(my(inner_top[1]))}Z"
    return d


def star_path() -> str:
    # Four-point star: each side is a cubic; its two control points were fitted to measured widths
    R, (cx, cy) = STAR_R, STAR_C
    u, v = 0.208 * R, 0.0955 * R  # fitted to the measured width of the arms

    def P(x: float, y: float) -> str:
        return f"{f(mx(cx + x))} {f(my(cy + y))}"

    sides = [
        ((0, -R), (u, -v), (v, -u), (R, 0)),
        ((R, 0), (v, u), (u, v), (0, R)),
        ((0, R), (-u, v), (-v, u), (-R, 0)),
        ((-R, 0), (-v, -u), (-u, -v), (0, -R)),
    ]
    d = f"M{P(*sides[0][0])}"
    for _, c1, c2, e in sides:
        d += f"C{P(*c1)} {P(*c2)} {P(*e)}"
    return d + "Z"


def orbit_path() -> tuple[str, float]:
    x, y = ORBIT_PTS[:, 0], ORBIT_PTS[:, 1]
    A = np.stack([x * x, x * y, y * y, x, y], axis=1)
    a, b, c, dd, e = np.linalg.lstsq(A, np.ones(len(x)), rcond=None)[0]
    # centre, axes, angle of the conic a x^2 + b xy + c y^2 + d x + e y = 1
    M = np.array([[a, b / 2], [b / 2, c]])
    centre = np.linalg.solve(2 * M, -np.array([dd, e]))
    k = 1 + centre @ M @ centre
    evals, evecs = np.linalg.eigh(M / k)
    radii = 1 / np.sqrt(evals)  # ascending eigenvalue = longer axis first
    major = evecs[:, 0]
    angle = math.degrees(math.atan2(major[1], major[0]))
    return centre, radii, angle


def orbit_arc() -> str:
    """The orbit's visible part: from where it meets the C's left edge, down and
    round the bottom (in front of the C), up the right to where it tucks behind
    the star's right arm. The top, between the C and the star, is left open."""
    centre, radii, angle = orbit_path()
    rot = math.radians(angle)
    R = np.array([[math.cos(rot), -math.sin(rot)], [math.sin(rot), math.cos(rot)]])

    def on_ellipse(p: tuple[float, float]) -> tuple[float, float]:
        u, v = R.T @ (np.array(p) - centre)
        t = math.atan2(v / radii[1], u / radii[0])
        q = centre + R @ np.array([radii[0] * math.cos(t), radii[1] * math.sin(t)])
        return float(q[0]), float(q[1])

    start, end = on_ellipse((252, 372)), on_ellipse((509, 304))
    ang = angle if angle < 90 else angle - 180  # an ellipse looks the same turned half a circle
    return (
        f"M{f(mx(start[0]))} {f(my(start[1]))}"
        f"A{f(radii[0] * SCALE)} {f(radii[1] * SCALE)} {f(ang)} 1 0 {f(mx(end[0]))} {f(my(end[1]))}"
    )


if __name__ == "__main__":
    print("ORBIT", orbit_arc())
    print("C   ", c_path())
    print("STAR", star_path())
    centre, radii, angle = orbit_path()
    print("orbit centre", centre.round(1), "radii", radii.round(1), "angle", round(angle, 1))
