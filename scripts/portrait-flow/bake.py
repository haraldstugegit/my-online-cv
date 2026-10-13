"""
Bakes the outro animation: a dotted globe that flows into a dotted portrait.

    uv run bake.py                 # bake + preview with the defaults below
    uv run bake.py --swirl 1.2     # tune and re-bake

Pipeline
  1. Stipple the photo: a density map (dark = dense, background = empty)
     sampled with weighted Lloyd relaxation, giving N evenly spread dots.
  2. Globe: N Fibonacci-sphere points, projected at a fixed spin angle.
  3. Mass transport: the optimal (squared-distance) assignment of globe dots
     to portrait dots. In Benamou-Brenier form this is a pressureless fluid
     flow, every dot moving in a straight line at constant velocity.
  4. Fluid: the dots stir an incompressible 2D Navier-Stokes field
     (stable fluids: advect + FFT pressure projection) seeded with some
     turbulence. The swirl is added on top of the transport flow, fading in
     and out so the dots still start on the globe and land on the portrait.
  5. Write keyframes to public/portrait-flow.bin and a preview to out/.

Coordinates: units where the globe has radius 1, centred on (0, 0), x right
and y down (screen convention). The UI scales one unit to its globe radius.

Binary layout (little endian):
  header, 32 bytes:
    char[4] magic "PFLW"
    u32     version (1)
    u32     N dots
    u32     K keyframes (evenly spaced in t = 0..1)
    f32     spin   globe angle at the hand-off (radians)
    f32     tilt   globe tilt towards the viewer (radians)
    f32     extent portrait half-size in units
    f32     quant  int16 -> units scale
  f32[N*3]  sphere points (x, y, z), unit sphere, y up
  i16[K*N*2] keyframe positions (x, y) * 1/quant, frame-major

The globe projection the UI must reproduce (see project()):
  x1 =  x cos(spin) + z sin(spin);  z1 = -x sin(spin) + z cos(spin)
  y2 =  y cos(tilt) - z1 sin(tilt); z2 =  y sin(tilt) + z1 cos(tilt)
  screen = (x1, -y2), depth = z2 (towards the viewer)
Keyframe 0 equals project(sphere, spin, tilt).
"""

from __future__ import annotations

import argparse
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_fill_holes, binary_opening, gaussian_filter, map_coordinates, sobel
from scipy.optimize import linear_sum_assignment
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

QUANT = 2.5 / 32767  # positions stay within +-2.5 units


# --- 1. Portrait ---------------------------------------------------------------


def density_map(path: Path, res: int, crop: tuple[float, float, float], args) -> np.ndarray:
    """Square crop of the photo as a dot density in 0..1 (rows = y down)."""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    cx, top, size = crop  # centre x and top as fractions of width/height, size as fraction of height
    side = size * h
    box = (cx * w - side / 2, top * h, cx * w + side / 2, top * h + side)
    a = np.asarray(img.crop(tuple(round(v) for v in box)).resize((res, res), Image.LANCZOS), dtype=np.float64) / 255

    # Background = colour of the photo's border; foreground = clearly different colour.
    full = np.asarray(img, dtype=np.float64) / 255
    border = np.concatenate([full[:20].reshape(-1, 3), full[:, :20].reshape(-1, 3), full[:, -20:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(a - bg, axis=2)
    mask = binary_fill_holes(binary_opening(dist > args.bg_threshold, iterations=2))
    soft = gaussian_filter(mask.astype(np.float64), 1.5)

    lum = a @ np.array([0.299, 0.587, 0.114])
    lum = gaussian_filter(lum, 0.8)
    edges = np.hypot(sobel(lum, 0), sobel(lum, 1))
    edges = np.clip(edges / (np.percentile(edges[mask], 98) + 1e-9), 0, 1)

    # Fade out towards the bottom and sides, so the crop doesn't leave hard edges.
    ramp = np.clip(np.minimum(np.arange(res), np.arange(res)[::-1]) / (args.fade * res + 1e-9), 0, 1)
    bottom = np.clip((res - 1 - np.arange(res)) / (args.fade * res + 1e-9), 0, 1)
    vignette = (bottom[:, None] * ramp[None, :]) ** 1.5

    return soft * vignette * (args.base + (1 - lum) ** args.gamma + args.edge * edges)


def stipple(density: np.ndarray, n: int, iterations: int, rng: np.random.Generator) -> np.ndarray:
    """Weighted Lloyd relaxation (Secord-style stippling). Returns (n, 2) pixel coords (x, y)."""
    res = density.shape[0]
    ys, xs = np.mgrid[0:res, 0:res]
    pix = np.column_stack([xs.ravel() + 0.5, ys.ravel() + 0.5])
    w = density.ravel()
    keep = w > 1e-4
    pix, w = pix[keep], w[keep]

    pts = pix[rng.choice(len(pix), n, replace=False, p=w / w.sum())] + rng.uniform(-0.5, 0.5, (n, 2))
    for _ in range(iterations):
        _, idx = cKDTree(pts).query(pix, workers=-1)
        mass = np.bincount(idx, w, n)
        cx = np.bincount(idx, w * pix[:, 0], n)
        cy = np.bincount(idx, w * pix[:, 1], n)
        has = mass > 0
        pts[has] = np.column_stack([cx[has], cy[has]]) / mass[has, None]
    return pts


# --- 2. Globe ------------------------------------------------------------------


def fibonacci_sphere(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    y = 1 - 2 * i / n
    r = np.sqrt(1 - y * y)
    theta = np.pi * (3 - np.sqrt(5)) * np.arange(n)
    return np.column_stack([np.cos(theta) * r, y, np.sin(theta) * r])


def project(p: np.ndarray, spin: float, tilt: float) -> tuple[np.ndarray, np.ndarray]:
    x, y, z = p.T
    x1 = x * np.cos(spin) + z * np.sin(spin)
    z1 = -x * np.sin(spin) + z * np.cos(spin)
    y2 = y * np.cos(tilt) - z1 * np.sin(tilt)
    z2 = y * np.sin(tilt) + z1 * np.cos(tilt)
    return np.column_stack([x1, -y2]), z2


# --- 4. Fluid ------------------------------------------------------------------


class Fluid:
    """2D incompressible fluid on a periodic grid (Stam's stable fluids)."""

    def __init__(self, grid: int, half: float, turbulence: float, rng: np.random.Generator):
        self.g, self.half = grid, half
        self.dx = 2 * half / grid
        k = 2 * np.pi * np.fft.fftfreq(grid, d=self.dx)
        self.kx, self.ky = np.meshgrid(k, k)  # columns = x, rows = y
        self.k2 = self.kx**2 + self.ky**2
        self.k2[0, 0] = 1

        # Initial turbulence: curl of a smoothed random stream function.
        psi = gaussian_filter(rng.normal(size=(grid, grid)), grid / 16, mode="wrap")
        gy, gx = np.gradient(psi, self.dx)
        self.u, self.v = gy, -gx
        rms = np.sqrt((self.u**2 + self.v**2).mean()) + 1e-12
        self.u *= turbulence / rms
        self.v *= turbulence / rms

    def cells(self, pos: np.ndarray) -> list[np.ndarray]:
        return [(pos[:, 1] + self.half) / self.dx - 0.5, (pos[:, 0] + self.half) / self.dx - 0.5]

    def sample(self, pos: np.ndarray) -> np.ndarray:
        c = self.cells(pos)
        return np.column_stack(
            [map_coordinates(self.u, c, order=1, mode="grid-wrap"), map_coordinates(self.v, c, order=1, mode="grid-wrap")]
        )

    def step(self, dt: float, pos: np.ndarray, vel: np.ndarray, stir: float, damping: float):
        # Force: the moving dots push the fluid along with them.
        r, c = (np.round(x).astype(int) % self.g for x in self.cells(pos))
        fu = np.zeros((self.g, self.g))
        fv = np.zeros((self.g, self.g))
        np.add.at(fu, (r, c), vel[:, 0])
        np.add.at(fv, (r, c), vel[:, 1])
        self.u += dt * stir * gaussian_filter(fu, 2, mode="wrap")
        self.v += dt * stir * gaussian_filter(fv, 2, mode="wrap")

        # Semi-Lagrangian self-advection.
        rows, cols = np.mgrid[0 : self.g, 0 : self.g].astype(np.float64)
        back = [rows - dt * self.v / self.dx, cols - dt * self.u / self.dx]
        self.u = map_coordinates(self.u, back, order=1, mode="grid-wrap")
        self.v = map_coordinates(self.v, back, order=1, mode="grid-wrap")

        # Pressure projection: remove the divergent part, keep the swirl.
        uh, vh = np.fft.fft2(self.u), np.fft.fft2(self.v)
        div = (self.kx * uh + self.ky * vh) / self.k2
        self.u = np.real(np.fft.ifft2(uh - self.kx * div))
        self.v = np.real(np.fft.ifft2(vh - self.ky * div))

        self.u *= 1 - damping * dt
        self.v *= 1 - damping * dt


def flow(start: np.ndarray, end: np.ndarray, args, rng: np.random.Generator) -> np.ndarray:
    """Dot positions at K keyframes: transport flow plus fluid swirl, landing exactly on `end`."""
    steps, k = args.steps, args.keyframes
    fluid = Fluid(args.grid, 2.4, args.turbulence, rng)
    v_ot = end - start  # constant-velocity transport (t runs 0..1)
    pos = start.copy()
    dt = 1 / steps

    path = [start.copy()]
    for s in range(steps):
        t = (s + 0.5) * dt
        envelope = np.sin(np.pi * t) ** 2
        swirl = fluid.sample(pos) * args.swirl * envelope
        fluid.step(dt, pos, v_ot, args.stir, args.damping)
        pos = pos + dt * (v_ot + swirl)
        path.append(pos.copy())
    path = np.array(path)  # (steps + 1, N, 2)

    # Fold the leftover drift back in, weighted by how much swirl has happened so far.
    ts = np.linspace(0, 1, steps + 1)
    env = np.sin(np.pi * ts) ** 2
    weight = np.concatenate([[0], np.cumsum((env[1:] + env[:-1]) / 2)])
    weight /= weight[-1]
    path -= weight[:, None, None] * (path[-1] - end)[None]

    pick = np.round(np.linspace(0, steps, k)).astype(int)
    return path[pick]


# --- 5. Output -----------------------------------------------------------------


def write_bin(out: Path, sphere: np.ndarray, frames: np.ndarray, spin: float, tilt: float, extent: float):
    n, k = sphere.shape[0], frames.shape[0]
    q = np.clip(np.round(frames / QUANT), -32767, 32767).astype("<i2")
    header = struct.pack("<4sIIIffff", b"PFLW", 1, n, k, spin, tilt, extent, QUANT)
    out.write_bytes(header + sphere.astype("<f4").tobytes() + q.tobytes())


def catmull(frames: np.ndarray, t: float) -> np.ndarray:
    """Same keyframe interpolation the UI uses."""
    k = len(frames)
    f = t * (k - 1)
    i = min(int(f), k - 2)
    u = f - i
    p0, p1, p2, p3 = (frames[min(max(j, 0), k - 1)] for j in (i - 1, i, i + 1, i + 2))
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u**2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u**3)


def render(pos: np.ndarray, alpha: np.ndarray, size: int, dot: float) -> Image.Image:
    img = Image.new("L", (size, size), 250)
    draw = ImageDraw.Draw(img)
    scale = size / (2 * 1.6)
    for (x, y), a in zip(pos, alpha):
        px, py = size / 2 + x * scale, size / 2 + y * scale
        draw.ellipse((px - dot, py - dot, px + dot, py + dot), fill=int(250 - 225 * a))
    return img


def preview(out_dir: Path, sphere: np.ndarray, frames: np.ndarray, depth: np.ndarray, args):
    size, fps = 720, 30
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{size}x{size}",
         "-r", str(fps), "-i", "-", "-pix_fmt", "yuv420p", "-vcodec", "libx264", str(out_dir / "preview.mp4")],
        stdin=subprocess.PIPE,
    )
    globe_alpha = 0.25 + 0.75 * (depth + 1) / 2
    stills = {}

    def emit(img: Image.Image, label: str | None = None):
        proc.stdin.write(img.tobytes())
        if label:
            stills[label] = img

    # Globe spinning, easing into the hand-off angle.
    for f in range(int(fps * 2)):
        e = 1 - (1 - f / (fps * 2 - 1)) ** 3
        pos, d = project(sphere, args.spin - (1 - e) * np.pi, args.tilt)
        emit(render(pos, 0.25 + 0.75 * (d + 1) / 2, size, args.dot), "globe" if f == fps * 2 - 1 else None)
    # The flow, with an ease-in-out on t like the scroll mapping will have.
    count = int(fps * 4)
    for f in range(count):
        x = f / (count - 1)
        t = x * x * (3 - 2 * x)
        label = {int(count * 0.25): "t25", int(count * 0.5): "t50", int(count * 0.75): "t75"}.get(f)
        emit(render(catmull(frames, t), globe_alpha + (1 - globe_alpha) * t, size, args.dot), label)
    for f in range(int(fps * 1.5)):
        emit(render(frames[-1], np.ones(len(sphere)), size, args.dot), "portrait" if f == 0 else None)
    proc.stdin.close()
    proc.wait()

    # Contact sheet of the key moments, for quick tuning without the video.
    tiles = [stills[k].resize((360, 360)) for k in ("globe", "t25", "t50", "t75", "portrait")]
    sheet = Image.new("L", (360 * len(tiles), 360), 250)
    for i, tile in enumerate(tiles):
        sheet.paste(tile, (360 * i, 0))
    sheet.save(out_dir / "contact.png")


# --- main ----------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", type=Path, default=ROOT / "assets/headshot_sep26.jpeg")
    ap.add_argument("--out", type=Path, default=ROOT / "public/portrait-flow.bin")
    ap.add_argument("--dots", type=int, default=4000)
    ap.add_argument("--keyframes", type=int, default=40)
    ap.add_argument("--seed", type=int, default=7)
    # Portrait
    ap.add_argument("--crop", type=float, nargs=3, default=(0.49, 0.02, 0.82), metavar=("CX", "TOP", "SIZE"),
                    help="square crop: centre x (frac of width), top and side (frac of height)")
    ap.add_argument("--extent", type=float, default=1.3, help="portrait half-size in globe radii")
    ap.add_argument("--bg-threshold", type=float, default=0.1, help="colour distance that counts as foreground")
    ap.add_argument("--base", type=float, default=0.05, help="density everywhere on the person")
    ap.add_argument("--gamma", type=float, default=2.2, help="darkness -> density curve")
    ap.add_argument("--edge", type=float, default=0.8, help="extra density on edges (features, outline)")
    ap.add_argument("--fade", type=float, default=0.15, help="soft fade towards the crop's bottom and sides")
    ap.add_argument("--lloyd", type=int, default=40, help="stippling relaxation iterations")
    # Globe
    ap.add_argument("--spin", type=float, default=0.0)
    ap.add_argument("--tilt", type=float, default=0.35)
    # Fluid
    ap.add_argument("--steps", type=int, default=240)
    ap.add_argument("--grid", type=int, default=128)
    ap.add_argument("--swirl", type=float, default=2.5, help="how strongly the fluid bends the paths")
    ap.add_argument("--turbulence", type=float, default=1.0, help="initial eddies in the fluid")
    ap.add_argument("--stir", type=float, default=6.0, help="how hard the moving dots push the fluid")
    ap.add_argument("--damping", type=float, default=0.5)
    # Preview
    ap.add_argument("--dot", type=float, default=1.6, help="preview dot radius (px at 720)")
    ap.add_argument("--no-preview", action="store_true")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)

    print("stippling…")
    res = 420
    density = density_map(args.image, res, tuple(args.crop), args)
    Image.fromarray((255 * (1 - density / density.max())).astype(np.uint8)).save(out_dir / "density.png")
    stip = stipple(density, args.dots, args.lloyd, rng)
    target = (stip / res * 2 - 1) * args.extent

    print("transport…")
    sphere = fibonacci_sphere(args.dots)
    start, depth = project(sphere, args.spin, args.tilt)
    cost = ((start[:, None, :] - target[None, :, :]) ** 2).sum(-1)
    _, assign = linear_sum_assignment(cost)
    end = target[assign]
    print(f"  mean distance {np.sqrt(cost[np.arange(args.dots), assign]).mean():.3f} units")

    print("fluid…")
    frames = flow(start, end, args, rng)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    write_bin(args.out, sphere, frames, args.spin, args.tilt, args.extent)
    print(f"wrote {args.out.relative_to(ROOT)} ({args.out.stat().st_size / 1024:.0f} KB)")

    if not args.no_preview:
        print("preview…")
        preview(out_dir, sphere, frames, depth, args)
        print(f"wrote {(out_dir / 'preview.mp4').relative_to(ROOT)} and contact.png, density.png")


if __name__ == "__main__":
    main()
