import barrelUrl from '../../sample/barel.png'
import crateUrl from '../../sample/crate.png'
import gateUrl from '../../sample/gate.png'
import houseOneUrl from '../../sample/house (1).png'
import houseTwoUrl from '../../sample/house2.png'
import houseThreeUrl from '../../sample/house3 (1).png'
import dirtTileUrl from '../../sample/tile_dirt (1).png'
import grassTileUrl from '../../sample/tile_grass (1).png'
import pavementTileUrl from '../../sample/tile_pavement.png'
import treeOneUrl from '../../sample/tree.png'
import treeTwoUrl from '../../sample/tree2.png'
import wallUrl from '../../sample/wall.png'

export interface SpriteAsset {
  image: HTMLImageElement
  src: string
}

export interface SampleSpriteSet {
  barrel: SpriteAsset
  crate: SpriteAsset
  dirt: SpriteAsset
  gate: SpriteAsset
  grass: SpriteAsset
  houses: [SpriteAsset, SpriteAsset, SpriteAsset]
  pavement: SpriteAsset
  trees: [SpriteAsset, SpriteAsset]
  wall: SpriteAsset
}

let spriteSetPromise: Promise<SampleSpriteSet> | null = null

export function loadSampleSpriteSet(): Promise<SampleSpriteSet> {
  if (!spriteSetPromise) {
    spriteSetPromise = Promise.all([
      loadSprite(barrelUrl),
      loadSprite(crateUrl),
      loadSprite(dirtTileUrl),
      loadSprite(gateUrl),
      loadSprite(grassTileUrl),
      loadSprite(houseOneUrl),
      loadSprite(houseTwoUrl),
      loadSprite(houseThreeUrl),
      loadSprite(pavementTileUrl),
      loadSprite(treeOneUrl),
      loadSprite(treeTwoUrl),
      loadSprite(wallUrl),
    ]).then(
      ([
        barrel,
        crate,
        dirt,
        gate,
        grass,
        houseOne,
        houseTwo,
        houseThree,
        pavement,
        treeOne,
        treeTwo,
        wall,
      ]) => ({
        barrel,
        crate,
        dirt,
        gate,
        grass,
        houses: [houseOne, houseTwo, houseThree],
        pavement,
        trees: [treeOne, treeTwo],
        wall,
      }),
    )
  }

  return spriteSetPromise
}

function loadSprite(src: string): Promise<SpriteAsset> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ image, src })
    image.onerror = () => reject(new Error(`Unable to load sprite: ${src}`))
    image.src = src
  })
}
