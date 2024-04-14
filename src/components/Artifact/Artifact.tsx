import "./style.scss";

import {
  REAL_SUBSTAT_VALUES,
  STAT_NAMES,
  getSubstatEfficiency,
} from "../../utils/substats";
import React, { useContext } from "react";
import {
  cssJoin,
  getArtifactCvClassName,
  getCharacterCvColor,
  getInGameSubstatValue,
  getSubstatPercentageEfficiency,
  isPercent,
  normalizeText,
} from "../../utils/helpers";

// img assets
import ArtifactBackground from "../../assets/images/artifact-5star-bg.png";
import NoArtifact from "../../assets/images/no-artifact.png";
import RarityStar from "../../assets/images/star.png";
import { TranslationContext } from "../../context/TranslationProvider/TranslationProviderContext";

type ArtifactProps = {
  artifact: {
    [key: string]: any;
    stars: number;
  };
  width?: any;
  equipped?: any;
};

export const Artifact: React.FC<ArtifactProps> = ({
  artifact,
  width = 270,
  equipped,
}) => {
  const { translate } = useContext(TranslationContext);

  const artifactBg =
    {
      5: ArtifactBackground,
      // @TODO: add more background to artifacts
      // 4: ArtifactBackground,
      // 3: ArtifactBackground,
      // 2: ArtifactBackground,
      // 1: ArtifactBackground,
      4: NoArtifact,
      3: NoArtifact,
      2: NoArtifact,
      1: NoArtifact,
    }[artifact?.stars] || NoArtifact;

  // const artifactHue = {
  //   5: '0deg',
  //   4: '-120deg',
  //   3: '-200deg',
  //   2: '0deg',
  //   1: '0deg',
  // }[artifact?.stars]

  const style = {
    "--artifact-bg": `url(${artifactBg})`,
    "--artifact-width": `${width}px`,
    // "filter": `hue-rotate(${artifactHue})`
  } as React.CSSProperties;

  const mainStatKey = artifact.mainStatKey
    ?.replace("Flat ", "")
    ?.replace("%", "");

  const isPercenrage =
    artifact.mainStatKey?.endsWith("%") ||
    artifact.mainStatKey?.endsWith("Bonus") ||
    ["Energy Recharge", "Crit RATE", "Crit DMG"].includes(artifact.mainStatKey);

  const summedArtifactRolls: {
    [key: string]: { count: number; sum: number; rv: number };
  } = artifact.substatsIdList.reduce((acc: any, id: number) => {
    const { value, type } = REAL_SUBSTAT_VALUES[id];
    const realStatName = STAT_NAMES[type];
    return {
      ...acc,
      [realStatName]: {
        count: (acc[realStatName]?.count ?? 0) + 1,
        sum: (acc[realStatName]?.sum ?? 0) + value,
        rv:
          (acc[realStatName]?.rv ?? 0) +
          getSubstatEfficiency(value, realStatName),
      },
    };
  }, {});

  const mainStatValue = isPercenrage
    ? Math.round(artifact.mainStatValue * 10) / 10
    : Math.round(artifact.mainStatValue);

  return (
    <div
      style={style}
      className={`profile-page-artifact ${getArtifactCvClassName(artifact)}`}
    >
      <div className="artifact-name">{translate(artifact.name)}</div>
      <div className="artifact-crit-value">
        {artifact.critValue > 0 ? `${artifact.critValue.toFixed(1)} cv` : ""}
      </div>
      <div className="artifact-stat-name">{translate(mainStatKey)}</div>
      <div className="artifact-stat-value">
        {mainStatValue}
        {isPercenrage ? "%" : ""}
      </div>
      <div className="artifact-level">+{artifact.level - 1}</div>
      <div className="artifact-rarity">
        {[...Array(artifact.stars)].map((e, i) => (
          <img alt="*" key={`star-${i}`} src={RarityStar} />
        ))}
      </div>
      <img alt="" className="artifact-icon" src={artifact.icon} />
      <div className="substats">
        {Object.keys(artifact.substats).map((key: any) => {
          const substatName = key.replace("%", "").replace("RATE", "Rate");
          const substatValue = getInGameSubstatValue(
            artifact.substats[key],
            key
          );
          const isCV = key.includes("Crit");
          const normSubName = normalizeText(key);
          const opacity = getSubstatPercentageEfficiency(
            normSubName,
            artifact.substats[key]
          );

          return (
            <div
              style={{ opacity: opacity }}
              key={normSubName}
              className={cssJoin([
                "substat",
                normSubName,
                isCV ? "critvalue" : "",
              ])}
            >
              <span className="substat-name">
                {translate(substatName.replace("Flat ", ""))}
              </span>
              <span className="substat-value">
                +{substatValue}
                {isPercent(key) ? "%" : ""}
              </span>
              <span className="rv-display">{summedArtifactRolls[key].rv}%</span>
            </div>
          );
        })}
      </div>
      <div className="artifact-set-name">{translate(artifact.setName)}</div>
      {equipped && equipped.length > 0 && (
        <div className="artifact-equipped-char">
          {equipped.map((build: any, index: number) => {
            const cv = build?.critValue || 0;

            let borderColor = getCharacterCvColor(cv);
            if (borderColor === "rainbow") borderColor = "red";

            const style = {
              backgroundImage: `url(${build.nameCardLink})`,
              boxShadow: `0 0 0 2px ${borderColor}`,
              backgroundPosition: "center",
            } as React.CSSProperties;

            return (
              <img
                alt=""
                key={`${build.characterId}-${index}`}
                src={build.icon}
                style={style}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
