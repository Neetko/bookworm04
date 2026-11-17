import { mkdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const covers = [
  ["pride-and-prejudice", 12645114],
  ["frankenstein", 109033],
  ["jane-eyre", 13863728],
  ["picture-of-dorian-gray", 15259210],
  ["dracula", 10541361],
  ["time-machine", 12650527],
  ["alice-in-wonderland", 12818031],
  ["sherlock-holmes", 8355309],
  ["count-of-monte-cristo", 14564134],
  ["frederick-douglass", 14699891],
  ["wuthering-heights", 12818862],
  ["little-women", 8775559],
  ["great-gatsby", 10590366],
  ["turn-of-the-screw", 181493],
  ["jekyll-and-hyde", 295773],
  ["war-of-the-worlds", 36314],
  ["twenty-thousand-leagues", 7063711],
  ["princess-of-mars", 207226],
  ["wizard-of-oz", 552443],
  ["peter-pan", 8237052],
  ["wind-in-the-willows", 13335427],
  ["treasure-island", 13859660],
  ["moby-dick", 10544254],
  ["secret-garden", 12622062],
  ["moonstone", 8237041],
  ["woman-in-white", 4684227],
  ["study-in-scarlet", 13405534],
  ["walden", 11248037],
  ["souls-of-black-folk", 6564090],
  ["benjamin-franklin-autobiography", 5647361],
]

const outputDirectory = path.join(process.cwd(), "public", "demo-covers")
await mkdir(outputDirectory, { recursive: true })

for (const [slug, coverId] of covers) {
  const sourceUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`Failed to download ${slug}: ${response.status} ${response.statusText}`)
  }

  const source = Buffer.from(await response.arrayBuffer())
  const outputPath = path.join(outputDirectory, `${slug}.webp`)

  await sharp(source)
    .rotate()
    .resize({ width: 360, height: 540, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76, effort: 6 })
    .toFile(outputPath)

  console.log(`Prepared ${path.relative(process.cwd(), outputPath)}`)
}
