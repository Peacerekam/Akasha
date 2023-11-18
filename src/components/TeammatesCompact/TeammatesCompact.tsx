import "./style.scss";

import React, { useContext } from "react";

import AnemoBg from "../../assets/images/teammates/anemo-team-bg.png";
import CryoBg from "../../assets/images/teammates/cryo-team-bg.png";
import DendroBg from "../../assets/images/teammates/dendro-team-bg.png";
import { ELEMENT_TO_COLOR } from "../CharacterCard/cardHelpers";
import ElectroBg from "../../assets/images/teammates/electro-team-bg.png";
import FlexIcon from "../../assets/icons/world-quest.webp";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import GeoBg from "../../assets/images/teammates/geo-team-bg.png";
import HydroBg from "../../assets/images/teammates/hydro-team-bg.png";
import PyroBg from "../../assets/images/teammates/pyro-team-bg.png";
import { StatIcon } from "../StatIcon";
import { TranslationContext } from "../../context/TranslationProvider/TranslationProviderContext";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { shadeColor } from "../../utils/helpers";

export type Elements =
  | "Cryo"
  | "Anemo"
  | "Dendro"
  | "Geo"
  | "Pyro"
  | "Hydro"
  | "Electro";

export type CalculationTeammate = {
  character?: {
    rarity?: "5" | "4";
    element?: Elements;
    name?: string;
    icon?: string;
    constellation?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    artifactSet?: string;
    artifactSetIcon?: string;
  };
  weapon?: {
    name?: string;
    rarity?: "5" | "4" | "3";
    icon?: string;
    refinement?: 1 | 2 | 3 | 4 | 5;
  };
};

type TeammatesCompactProps = {
  teammates?: CalculationTeammate[];
  scale?: number;
  coloredBackground?: boolean;
  simplify?: boolean;
};

const getBgColor = (teammate: CalculationTeammate) => {
  if (!teammate.character) return ["transparent"];

  const elementColor = ELEMENT_TO_COLOR[teammate?.character?.element || ""];

  if (!teammate.character.rarity) {
    const col = elementColor || "gray";
    return ["rgb(81, 81, 81)", col, `${col}85`];

    // const col =
    //   ELEMENT_TO_COLOR[teammate?.character?.element || ""] || "transparent";

    // return teammate.character?.element
    //   ? [`${col}95`, col]
    //   : ["rgb(61, 61, 61)", "gray"];
  }

  if (teammate?.character?.element) {
    const col = elementColor || "transparent";

    const colorsByRarity = {
      "5": "#BF8C40",
      "4": "#9F74AA",
    }[teammate.character.rarity];

    // return [
    //   colorsByRarity,
    //   colorsByRarity,
    //   null,
    //   colorsByRarity,
    //   shadeColor(colorsByRarity, -30),
    // ];

    return [
      `${ELEMENT_TO_COLOR[teammate?.character?.element]}95`,
      col,
      null,
      colorsByRarity,
      shadeColor(col, -30),
    ];
  }

  const colorsByRarity = {
    "5": "#BF8C40",
    "4": "#9F74AA",
  }[teammate.character.rarity];

  return [colorsByRarity, "transparent"];
};

const getBgImage = (teammate: CalculationTeammate) => {
  const bgImages = {
    Anemo: AnemoBg,
    Cryo: CryoBg,
    Dendro: DendroBg,
    Electro: ElectroBg,
    Geo: GeoBg,
    Hydro: HydroBg,
    Pyro: PyroBg,
    "": "",
  };

  const element = teammate?.character?.element || "";

  return bgImages[element];
};

export const TeammatesCompact: React.FC<TeammatesCompactProps> = ({
  teammates,
  scale = 1,
  coloredBackground = true,
  simplify = false,
}) => {
  const { translate } = useContext(TranslationContext);

  if (!teammates) return null;

  const getCharacterTitle = (teammate: CalculationTeammate) => {
    const translatedCharName = translate(teammate.character?.name || "");
    const translatedWeaponName = translate(teammate.weapon?.name || "");

    const rawSetNum = teammate.character?.artifactSet?.slice(0, 3);
    const rawSetName = teammate.character?.artifactSet?.slice(3);
    const translatedArtifactSet = translate(rawSetName || "");

    const constellation =
      (teammate?.character?.constellation || -1) >= 0
        ? ` C${teammate?.character?.constellation}`
        : "";

    const weaponName = translatedWeaponName ? ` - ${translatedWeaponName}` : "";

    const weaponRefinement =
      (teammate?.weapon?.refinement || 0) >= 1
        ? ` R${teammate?.weapon?.refinement}`
        : "";

    const artifactSet = translatedArtifactSet
      ? ` - ${rawSetNum}${translatedArtifactSet}`
      : "";

    return `${translatedCharName}${constellation}${weaponName}${weaponRefinement}${artifactSet}`;
  };

  const noTeammateIcon = () => {
    // return <></>
    return flexTeammateIcon();

    // return (
    //   <div className="no-teammate-fill-img">
    //     <FontAwesomeIcon
    //       icon={faXmark}
    //       size={`${Math.round(scale)}x` as SizeProp}
    //     />
    //   </div>
    // );
  };

  const flexTeammateIcon = () => {
    return <img alt=" " className="flex-fill-img" src={FlexIcon} />;
  };

  const teammateIcon = (teammate: CalculationTeammate) => {
    return (
      <img alt=" " className="table-icon" src={teammate.character?.icon} />
    );
  };

  const renderTeammate = (teammate: CalculationTeammate, index: number) => {
    // @DEBUG
    // teammate = {
    //   character: {
    //     name: "zzz",
    //     icon: "",
    //     element: "Anemo"
    //   }
    // }

    const isEmpty = teammate.character?.name === "x";
    const isFlex = teammate.character?.name === "Flex";
    const isNonFill = teammate.character?.icon;

    let innerElement = <></>;
    let title = "";

    if (isEmpty) {
      title = `No teammate`;
      innerElement = noTeammateIcon();
    } else if (isFlex) {
      title = `Any teammate`;
      innerElement = flexTeammateIcon();
    } else if (isNonFill) {
      title = getCharacterTitle(teammate);
      innerElement = teammateIcon(teammate);
    } else {
      title = `Any ${teammate.character?.element} teammate`;
      innerElement = <StatIcon name={teammate.character?.element || ""} />;
      // innerElement = <div className="table-icon" />
    }

    const teammateStyle = (
      coloredBackground
        ? {
            "--teammate-background": getBgColor(teammate)[0],
            "--teammate-border": getBgColor(teammate)[1],
            "--teammate-inner-shadow": getBgColor(teammate)[2] || "transparent",
            "--teammate-rarity": getBgColor(teammate)[3],
            "--teammate-bg-darker": getBgColor(teammate)[4],
            "--teammate-bg-image": `url(${getBgImage(teammate)})`,
          }
        : {}
    ) as React.CSSProperties;

    const constellation = teammate.character?.constellation;

    return (
      <div
        tabIndex={0}
        key={`teammate-${index}`}
        title={title}
        className={`teammate-wrapper ${coloredBackground ? "" : "no-bg"}`}
        style={teammateStyle}
      >
        {innerElement}
        <div className="teammate-bg" />
        {!simplify && isNonFill && constellation ? (
          <div className="teammate-const-overlay">
            {constellation}
            {constellation !== 6 ? <FontAwesomeIcon icon={faPlus} /> : null}
          </div>
        ) : (
          ""
        )}
        {!simplify && (
          <div className="overlay-icons-container">
            {isNonFill && teammate.weapon?.icon ? (
              <div className="overlay-weapon-wrapper">
                <img
                  alt=" "
                  className="table-icon overlay-icon"
                  src={teammate.weapon?.icon}
                />
              </div>
            ) : (
              ""
            )}
            {isNonFill && teammate.character?.artifactSet ? (
              <div className="overlay-artifact-wrapper">
                <img
                  alt=" "
                  className="table-icon overlay-icon"
                  src={teammate.character?.artifactSetIcon}
                />
              </div>
            ) : (
              ""
            )}
          </div>
        )}
      </div>
    );
  };

  const teamDisplayStyle = {
    "--teammate-scale": scale,
  } as React.CSSProperties;

  return (
    <div className="team-display" style={teamDisplayStyle}>
      {teammates.map(renderTeammate)}
    </div>
  );
};
