/**
 * NASA 3D models shown in the story panel (3D tab). Files are NASA 3D Resources GLBs
 * (Draco-compressed) stored in public/models/; the Draco decoder is in public/draco/.
 * Picked after Uygar Yıldırım's Offworld Archive, which shows the same models.
 *
 * `representative`: the model is the same design, not this exact craft (e.g. one Apollo
 * Lunar Module model for every landing; Spirit shown with its twin Opportunity's model).
 */
export interface CraftModel {
  src: string
  credit: string
  page: string
  representative?: boolean
}

const LM: CraftModel = {
  src: '/models/apollo-lm.glb', credit: 'NASA/Michael D. Carbajal',
  page: 'https://science.nasa.gov/3d-resources/apollo-lunar-module/', representative: true,
}
const MER: CraftModel = {
  src: '/models/mer.glb', credit: 'NASA/Ames Research Center',
  page: 'https://science.nasa.gov/3d-resources/mars-exploration-rover-opportunity-mer-b/',
}

export const MODELS: Record<string, CraftModel> = {
  'a11-lm': LM, 'a12-lm': LM, 'a14-lm': LM, 'a15-lm': LM, 'a16-lm': LM, 'a17-lm': LM,
  opportunity: MER,
  spirit: { ...MER, representative: true },
  perseverance: {
    src: '/models/perseverance.glb', credit: 'NASA/JPL',
    page: 'https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/',
  },
  insight: {
    src: '/models/insight.glb', credit: 'NASA/VTAD',
    page: 'https://science.nasa.gov/3d-resources/insight-cruise-lander/',
  },
  ingenuity: {
    src: '/models/ingenuity.glb', credit: 'NASA/Brian E. Kumanchik',
    page: 'https://science.nasa.gov/3d-resources/ingenuity-mars-helicopter/',
  },
}
