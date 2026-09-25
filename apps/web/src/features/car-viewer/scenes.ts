export type SceneId = "studio" | "city" | "street";

export interface PanoramaScene {
  label: string;
  /** Панорама CC0 с Poly Haven, лежит в apps/api/public/assets/hdri. */
  file: string;
  /** Высота съёмки панорамы над землёй, м: от неё зависит, где пол. */
  height: number;
  /** Радиус «пола»: дальше проекция уходит в стены и небо. */
  radius: number;
  /** Экспозиция: панорамы сняты с разной яркостью. */
  exposure: number;
  /** Сила отражений и заливающего света от панорамы. */
  intensity: number;
  /** Поворот панорамы вокруг вертикали, рад: что оказывается за машиной
   *  в исходном виде. Уводит из кадра предметы, которые проекция на пол
   *  искажает сильнее всего (припаркованные машины у самой камеры). */
  rotation: number;
}

export const SCENES = {
  studio: { label: "Стенд" },
  city: {
    label: "Город",
    file: "/assets/hdri/canary_wharf_2k.hdr",
    height: 1.7,
    radius: 60,
    exposure: 1,
    intensity: 1,
    rotation: 0,
  },
  street: {
    label: "Улица",
    file: "/assets/hdri/urban_street_01_2k.hdr",
    height: 1.7,
    radius: 40,
    exposure: 1.3,
    intensity: 1,
    rotation: Math.PI,
  },
} satisfies Record<SceneId, { label: string } | PanoramaScene>;

export const SCENE_IDS = Object.keys(SCENES) as SceneId[];

/** Экспозиция стенда — база, к которой сцены возвращаются. */
export const STUDIO_EXPOSURE = 1.05;
