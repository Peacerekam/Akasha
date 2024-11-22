import "./style.scss";

import { Chart as ChartJS, registerables } from "chart.js";
import {
  ELEMENT_TO_COLOR,
  calcStatVals,
  handleTitle,
  scales,
  setGradientFromImage,
  toTalentProps,
} from "./cardHelpers";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { STAT_NAMES, fixCritValue, roundToFixed } from "../../utils/substats";
import { applyModalBodyStyle, getRelativeCoords } from "../CustomTable/Filters";
import {
  ascensionToLevel,
  cssJoin,
  delay,
  getArtifactsInOrder,
  getGenderFromIcon,
  getSessionIdFromCookie,
  isPercent,
  toEnkaUrl,
} from "../../utils/helpers";
import axios, { AxiosRequestConfig } from "axios";
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faCheck,
  faCog,
  faDownload,
  faImage,
  faLock,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faRefresh,
  faUpload,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import html2canvas, { Options } from "html2canvas";
import { useLocation, useParams } from "react-router-dom";

import { AdProviderContext } from "../../context/AdProvider/AdProviderContext";
import { CompactArtifact } from "../ArtifactListCompact";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import FriendshipIcon from "../../assets/icons/Item_Companionship_EXP.png";
import { PreviewModal } from "./PreviewModal";
import { Radar } from "react-chartjs-2";
import RarityStar from "../../assets/images/star.png";
import ReactSelect from "react-select";
import { RollList } from "../RollList";
import { SessionDataContext } from "../../context/SessionData/SessionDataContext";
import { SettingsContext } from "../../context/SettingsProvider/SettingsProvider";
import { Spinner } from "../Spinner";
import { StatIcon } from "../StatIcon";
import { StatListCard } from "../StatListCard";
import { TalentDisplay } from "./TalentDisplay";
import { TeammatesCompact } from "../TeammatesCompact";
import { TranslationContext } from "../../context/TranslationProvider/TranslationProviderContext";
import { WeaponMiniDisplay } from "../WeaponMiniDisplay";
import { reactSelectCustomFilterTheme } from "../../utils/reactSelectCustomFilterTheme";
import throttle from "lodash/throttle";
import { useCardSettings } from "../../hooks/";

// import imglyRemoveBackground, { Config } from "@imgly/background-removal";

// import { toBlob, toPng } from "html-to-image";

ChartJS.register(...registerables);

type CharacterCardProps = {
  row: any;
  artifacts: any[];
  _calculations: any;
  setSelectedCalculationId?: any;
  errorCallback?: () => {};
  invalidateCache?: () => void;
};

type Coords = {
  x: number;
  y: number;
};

type MouseOrTouchEvent =
  | React.MouseEvent<HTMLDivElement>
  | React.TouchEvent<HTMLDivElement>;

const compressPNG = async (
  result: string,
  canvasWidth: number,
  canvasHeight: number,
  qualityFactor: number
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const blobToDataURL = (blob: any, callback: any) => {
      const reader = new FileReader();
      reader.onload = function (e: any) {
        callback(e.target.result);
      };
      reader.readAsDataURL(blob);
    };

    img.onload = function () {
      canvas.width = img.naturalWidth; // update canvas size to match image
      canvas.height = img.naturalHeight;

      const imageWidth = img.width;
      const imageHeight = img.height;

      const canvasScale =
        Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight) *
        qualityFactor;

      // Finding the new width and height based on the scale factor
      const newWidth = imageWidth * canvasScale;
      const newHeight = imageHeight * canvasScale;

      canvas.width = newWidth; // update canvas size to match image
      canvas.height = newHeight;

      // ___ctx!.globalCompositeOperation = "source-in";
      ctx!.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        async (blob) => {
          blobToDataURL(blob, (dataURL: any) => {
            resolve(dataURL + "");
          });
        }
        // "image/jpeg",
        // 0.9
      );
    };
    img.crossOrigin = "anonymous"; // if from different origin
    img.src = result + "";
  });
};

const getCoordsFromEvent = (event: MouseOrTouchEvent) => {
  const isMouseEvent = "clientX" in event;
  const coords = isMouseEvent
    ? event
    : event?.touches?.[0] || event?.changedTouches?.[0];

  const x = coords.clientX || 0;
  const y = coords.clientY || 0;

  return { x, y };
};

type OpenDownloadingFalse = "opening" | "downloading" | false;
type VerticalOrHorizontal = "vertical" | "horizontal" | "";

export const CharacterCard: React.FC<CharacterCardProps> = ({
  row,
  artifacts,
  _calculations,
  setSelectedCalculationId,
  errorCallback,
  invalidateCache,
}) => {
  // states
  const [width, setWidth] = useState<number>(window.innerWidth);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [imagePreviewBlob, setImagePreviewBlob] = useState<Blob>();
  const [filteredLeaderboards, setFilteredLeaderboards] = useState<any[]>([]);
  const [adaptiveColors, setAdaptiveColors] = useState<[string[], string[]]>();
  const [customCardPic, setCustomCardPic] = useState(row?.customCardPic);

  // flags
  const [toggleConfigure, setToggleConfigure] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [generating, setGenerating] = useState<OpenDownloadingFalse>(false);
  const [uploading, setUploading] = useState(false);
  const [hasCustomBg, setHasCustomBg] = useState<VerticalOrHorizontal>("");
  const [skipGradient, setSkipGradient] = useState(false);
  const [picLoaded, setPicLoaded] = useState(false);

  // dragging related
  const [compressedImage, setCompressedImage] = useState<string>();
  const [imgDimensions, setImgDimensions] = useState<Coords>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<Coords | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // refs
  const uploadPictureInputRef = useRef<HTMLInputElement>(null);
  const backgroundPictureRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasBgRef = useRef<HTMLCanvasElement>(null);

  // context
  const { translate } = useContext(TranslationContext);
  const { contentWidth, isMobile } = useContext(AdProviderContext);
  const { metric, customRvFilter, getTopRanking } = useContext(SettingsContext);
  const { profileObject, isAuthenticated, boundAccounts, isBound } =
    useContext(SessionDataContext);

  const { uid } = useParams();
  const isAccountOwner = useMemo(
    () => isBound(uid),
    [uid, isAuthenticated, boundAccounts]
  );

  const {
    displayBuildName,
    simplifyColors,
    adaptiveBgColor,
    namecardBg,
    privacyFlag,
    setDisplayBuildName,
    setSimplifyColors,
    setAdaptiveBgColor,
    setNamecardBg,
    setPrivacyFlag,
  } = useCardSettings();

  const [_adaptiveBgColor, _setAdaptiveBgColor] = useState(
    !!row.adaptiveBg || !!adaptiveBgColor
  );

  useEffect(() => {
    if (customCardPic || adaptiveBgColor === undefined) return;
    _setAdaptiveBgColor(!!adaptiveBgColor);
  }, [adaptiveBgColor]);

  useEffect(() => {
    if (!customCardPic) return;
    _setAdaptiveBgColor(!!row.adaptiveBg || !!adaptiveBgColor);
  }, [customCardPic]);

  const location = useLocation();
  const DEBUG_MODE = location.search?.includes("debug");

  const buildId = `${row.md5}`;
  const calculations = _calculations.calculations;
  const chartsData = _calculations.chartsData;
  const showPicSaveButton =
    profileObject?.isEnkaPatreon || profileObject?.isPatreon;

  const cardPicUrl = `${axios.defaults.baseURL}/public/cardpics/${customCardPic}`;

  const canvasPixelDensity = 2; // helps when exporting at higher scale
  const maxScale = contentWidth ? contentWidth / 1280 : 1;
  const hardcodedScale = +Math.max(0.87, maxScale).toFixed(3);

  const canvasWidth = 500 * hardcodedScale;
  const canvasHeight = 485 * hardcodedScale;
  const canvasBgWidth = 1200 * hardcodedScale;
  const canvasBgHeight = 485 * hardcodedScale;

  const noElementColor = "#ffffff";
  const elementKey = chartsData?.characterMetadata?.element;
  const elementalColor = ELEMENT_TO_COLOR[elementKey];

  const windowSizeT = 1280 - 10;
  const maxCardWidth = Math.min(windowSizeT, width);
  const scaleFactor = Math.max(0.75, +(maxCardWidth / windowSizeT));
  const formattedSF = scaleFactor.toFixed(3);
  const wrapperStyle = {
    "--hardcoded-card-scale": hardcodedScale,
    "--scale-factor": formattedSF,
  } as React.CSSProperties;

  const handleToggleModal = (event: React.MouseEvent<HTMLElement>) => {
    setShowPreviewModal((prev) => !prev);

    const offsets = getRelativeCoords(event);
    applyModalBodyStyle(offsets);
  };

  const handleWindowSizeChange = () => {
    setWidth(window.innerWidth);
  };

  const getReadableStatText = (_statName: string) => {
    const textMap: any = {
      maxHp: "HP",
      atk: "ATK",
      def: "DEF",
      elementalMastery: "EM",
      energyRecharge: "ER%",
      critRate: "Crit Rate",
      healingBonus: "Healing Bonus",
      critDamage: "Crit DMG",
    };

    const output =
      textMap[_statName] ||
      (_statName.endsWith("DamageBonus")
        ? `${_statName[0].toUpperCase()}${_statName
            .slice(1, _statName.length)
            .replace("DamageBonus", " DMG")}`
        : _statName);

    return translate(output);
  };

  const cardErrorCallback = async () => {
    if (!errorCallback) return;

    console.log("\nRerendering character card...", row.name, row.type);
    errorCallback();
  };

  // resize handler
  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);

    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, []);

  // lock viewport on mobile when dragging image on the card
  useEffect(() => {
    if (isMobile) {
      if (isDragging) {
        document.body!.classList.add("lock-viewport");
      } else {
        document.body!.classList.remove("lock-viewport");
      }
    }

    return () => {
      document.body!.classList.remove("lock-viewport");
    };
  }, [isDragging, isMobile]);

  // canvas pixel density
  useEffect(() => {
    if (!canvasRef.current || !backgroundPictureRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx!.scale(canvasPixelDensity, canvasPixelDensity);
  }, [canvasRef, backgroundPictureRef]);

  // canvas re-painting
  useEffect(() => {
    if (!backgroundPictureRef.current) return;
    if (_adaptiveBgColor === undefined || namecardBg === undefined) return;

    const paintMode =
      !customCardPic && !uploadPictureInputRef?.current?.files?.[0] && "gacha";
    const coldStart = true;

    const maybePaintImageToCanvas = async (i = 0) => {
      if (!backgroundPictureRef.current) return;
      if (i > 5) {
        cardErrorCallback();
        return;
      }

      try {
        paintImageToCanvas(
          compressedImage || backgroundPictureRef.current.src,
          paintMode,
          coldStart,
          null,
          false
        );
        setCompressedImage(compressedImage || backgroundPictureRef.current.src);
        setPicLoaded(!!uploadPictureInputRef?.current?.files?.[0]);
      } catch (err) {
        // second time's a charm
        await delay(10);
        maybePaintImageToCanvas(i + 1);
      }
    };

    setIsLoadingImage(true);
    maybePaintImageToCanvas();

    backgroundPictureRef.current.addEventListener("load", () => {
      setIsLoadingImage(false);
    });
  }, [
    cardPicUrl,
    customCardPic,
    backgroundPictureRef,
    _adaptiveBgColor,
    namecardBg,
    zoomLevel,
    compressedImage,
    skipGradient,
  ]);

  const calculationIds = useMemo(
    () =>
      Object.keys(calculations ?? [])
        .filter((c: any) => !calculations[c].hidden)
        .sort((a: any, b: any) => {
          const _a = calculations[a];
          const _b = calculations[b];

          const _aRank = ("" + _a.ranking)?.replace("~", "");
          const _bRank = ("" + _b.ranking)?.replace("~", "");

          const _aVal = _aRank.startsWith("(")
            ? _aRank.slice(1, _aRank.length - 1)
            : _aRank;

          const _bVal = _bRank.startsWith("(")
            ? _bRank.slice(1, _bRank.length - 1)
            : _bRank;

          const topA_ = +_aVal / _a.outOf;
          const topB_ = +_bVal / _b.outOf;

          const isTop1_a = Math.min(100, Math.ceil(topA_ * 100)) === 1;
          const isTop1_b = Math.min(100, Math.ceil(topB_ * 100)) === 1;

          const _priority = _b.priority - _a.priority;

          if (_priority !== 0) {
            return _priority;
          }

          if (isTop1_a && isTop1_b) {
            return +_aVal - +_bVal;
          }

          return topA_ - topB_;

          // return (
          //   _b.priority - _a.priority ||
          //   (isTop1_a && isTop1_b ? +_aVal - +_bVal : topA_ - topB_)
          // );

          // return +valA < +valB ? -1 : 1;
        }),
    [calculations]
  );

  useEffect(() => {
    const _calculationId = calculationIds.slice(0, 1);
    setFilteredLeaderboards(_calculationId);
    setSelectedCalculationId(_calculationId?.[0]);
  }, [calculationIds]);

  const displayCharts = useCallback(
    (chartData: any, calculationId: string, calcOverride?: any) => {
      if (!chartData?.avgStats) return <></>;

      const {
        pyroDamageBonus,
        hydroDamageBonus,
        cryoDamageBonus,
        dendroDamageBonus,
        electroDamageBonus,
        anemoDamageBonus,
        geoDamageBonus,
        physicalDamageBonus,
      } = chartData.avgStats;

      const dmgStats: any[] = [
        {
          name: "pyroDamageBonus",
          value: pyroDamageBonus,
        },
        {
          name: "electroDamageBonus",
          value: electroDamageBonus,
        },
        {
          name: "cryoDamageBonus",
          value: cryoDamageBonus,
        },
        {
          name: "geoDamageBonus",
          value: geoDamageBonus,
        },
        {
          name: "dendroDamageBonus",
          value: dendroDamageBonus,
        },
        {
          name: "anemoDamageBonus",
          value: anemoDamageBonus,
        },
        {
          name: "hydroDamageBonus",
          value: hydroDamageBonus,
        },
        {
          name: "physicalDamageBonus",
          value: physicalDamageBonus,
        },
      ];

      const sorted = dmgStats
        .sort((a, b) => {
          const numA = +(a.value || 0);
          const numB = +(b.value || 0);
          return numA > numB ? -1 : 1;
        })
        .slice(0, 5);

      const lowestDmg =
        sorted.length > 1 ? +sorted[sorted.length - 1].value : 0;

      const relevantDamageTypes = sorted.filter((a: any) => {
        const roundedA = +(a.value || 0).toFixed(2);
        const roundedLowest = +(lowestDmg || 0).toFixed(2);
        const minStatThreshold = 0.1; // 10% DMG
        const isNotLowest = roundedA !== roundedLowest;
        const isHigherThanThreshold = roundedA > minStatThreshold;
        const isNotNaN = !isNaN(a.value);
        return isNotLowest && isHigherThanThreshold && isNotNaN;
      });

      const relevantStatNames = Object.keys(chartData.avgStats).filter(
        (statName: string) =>
          !(
            statName.endsWith("DamageBonus") &&
            !relevantDamageTypes.find((x) => x.name === statName)
          )
      );

      const getMeaningfulValues = (x: any) => {
        // const isZero = 0 === x.calculatedVal && 0 === x.avg;
        const isNearZero =
          x.avg >= 0 &&
          x.avg <= 0.001 &&
          x.calculatedVal >= 0 &&
          x.calculatedVal <= 0.001;
        return !isNearZero;
      };

      const percentagesArray = relevantStatNames
        .map((statName: string) => {
          const calcStat = calcStatVals(statName);

          const relevantCalc = calcOverride || calculations[calculationId];
          const calculatedVal = calcStat.value(
            relevantCalc?.stats?.[calcStat.key]
          );

          const calcStatPercentage =
            calculatedVal / chartData.avgStats[statName];

          const getExtragrated = (weight: number) => {
            const _a =
              {
                maxDEF: calculatedVal + 750,
                elementalMastery:
                  calculatedVal > chartData.avgStats[statName]
                    ? calculatedVal + 150
                    : calculatedVal,
                critRate:
                  chartData.avgStats[statName] < 0
                    ? Math.abs(chartData.avgStats[statName]) * 2
                    : calculatedVal,
              }[calcStat.key] || calculatedVal;

            const _b =
              {
                maxDEF: chartData.avgStats[statName] + 750,
                elementalMastery:
                  calculatedVal > chartData.avgStats[statName]
                    ? chartData.avgStats[statName] + 150
                    : chartData.avgStats[statName],
                critRate:
                  chartData.avgStats[statName] < 0
                    ? Math.abs(chartData.avgStats[statName] + calculatedVal)
                    : chartData.avgStats[statName],
              }[calcStat.key] || chartData.avgStats[statName];

            const _rel = _a - _b;
            return (_rel * weight + _b) / _b;
          };

          const percentAdjustment = statName.endsWith("DamageBonus")
            ? getExtragrated(1.5)
            : {
                critRate: getExtragrated(2),
                critDamage: getExtragrated(2),
                maxHp: getExtragrated(2.5),
                atk: getExtragrated(3),
                def: getExtragrated(3),
                elementalMastery: getExtragrated(2),
                energyRecharge: getExtragrated(3),
              }[statName] || calcStatPercentage;

          const _percent = percentAdjustment * 100;
          // return _percent;
          return {
            _p: Math.max(10, Math.min(170, _percent)),
            calculatedVal,
            avg: chartData.avgStats[statName],
            statName,
          };
        })
        .filter(getMeaningfulValues);

      const neutralWhiteColor = "rgba(255, 255, 255, 0.35)";
      const elementColor =
        ELEMENT_TO_COLOR[chartsData?.characterMetadata?.element];

      const data = {
        labels: percentagesArray.map((x) => x.statName),
        datasets: [
          {
            pointHitRadius: 45 * hardcodedScale,
            label: `${row.type === "current" ? row.name : row.type}`,
            data: percentagesArray.map((x) => x._p),
            vals: percentagesArray.map((x) => x.calculatedVal),
            fill: true,
            backgroundColor: `${elementColor}45`,
            borderColor: `${elementColor}bb`,
            pointBackgroundColor: `${elementColor}bb`,
            pointBorderColor: `${elementColor}bb`,
            pointHoverBackgroundColor: generating ? neutralWhiteColor : `red`,
            pointHoverBorderColor: generating ? neutralWhiteColor : `white`,
          },
          {
            pointHitRadius: 45 * hardcodedScale,
            label: "TOP 1% AVG",
            data: percentagesArray.map((_) => 100),
            vals: percentagesArray.map((x) => x.avg),
            fill: false,
            backgroundColor: "transparent",
            borderColor: neutralWhiteColor,
            pointBackgroundColor: neutralWhiteColor,
            pointBorderColor: neutralWhiteColor,
            pointHoverBackgroundColor: generating ? neutralWhiteColor : `red`,
            pointHoverBorderColor: generating ? neutralWhiteColor : `white`,
          },
        ],
      };

      const plugins = {
        tooltip: {
          enabled: generating ? false : true,
          callbacks: {
            title: handleTitle,
            label: (obj: any) => {
              if (!obj) return "";
              if (!obj.dataset) return "";

              const statName = getReadableStatText(obj.label);
              const calcStat = calcStatVals(obj.label, true);

              const calculatedVal = roundToFixed(
                calcStat.value(obj.dataset.vals[obj.dataIndex]),
                1
              );

              return `${statName}: ${calculatedVal}`;
            },
          },
        },
        legend: {
          display: false,
        },
      };

      scales.r.pointLabels.callback = (statName: string, index: number) => {
        const translatedWord = getReadableStatText(statName);

        if (translatedWord.length > 13) {
          const _split = translatedWord.split(" ");

          if (_split.length > 2) {
            return _split.reduce(
              (acc, val, index) => {
                const mid = Math.floor(_split.length / 2);
                const lineNum = index >= mid ? 1 : 0;

                if (!acc[lineNum]) {
                  acc[lineNum] = val;
                } else {
                  acc[lineNum] += ` ${val}`;
                }

                return acc;
              },
              ["", ""]
            );
          }

          return _split;
        }

        return translatedWord;
      };

      scales.r.pointLabels.font.size = 9 * hardcodedScale;

      const radarOptions = {
        devicePixelRatio: 2,
        plugins,
        scales,
        elements: {
          point: {
            radius: 3 * hardcodedScale,
            hoverRadius: 3 * hardcodedScale,
            hoverBorderWidth: 1 * hardcodedScale,
          },
          line: {
            borderWidth: 2 * hardcodedScale,
          },
        },
      };

      return (
        <div className="chart-radar-wrapper">
          <Radar data={data} options={radarOptions} />
        </div>
      );
    },
    [row, calculations, chartsData, filteredLeaderboards, generating, translate]
  );

  const hasLeaderboardsColumn =
    filteredLeaderboards.length > 0 && filteredLeaderboards[0] !== "hide";

  /*
  const fillerChart = () => {
    const thisChartData = {
      avgStats: {
        atk: 2000,
        critDamage: 1.5,
        critRate: 0.75,
        def: 650,
        electroDamageBonus: 0.46,
        elementalMastery: 200,
        energyRecharge: 1.1,
        healingBonus: 0,
        maxHp: 15000,
        physicalDamageBonus: 0.0010121457489878543,
      },
    };

    // const row.stats needs to be translated to the other format
    const characterStats = row;

    return (
      <div>
        <div>{displayCharts(thisChartData, "", characterStats)}</div>
      </div>
    );
  };
  */

  const leaderboardHighlighs = useMemo(() => {
    return (
      <div className="card-leaderboards relative">
        {/* {!hasLeaderboardsColumn && fillerChart()} */}
        {filteredLeaderboards.map((id: any) => {
          const calc = calculations[id];
          if (!calc) return <div key={id} />;

          const {
            // name,
            ranking,
            outOf,
            // details,
            // weapon,
            // result,
            // stats,
            variant,
            // calculationId,
            short,
          } = calc;

          const leaveOnlyNumbersRegex = /\D+/g;

          const _ranking = +(ranking + "")?.replace(leaveOnlyNumbersRegex, "");
          const _percentage = getTopRanking(_ranking, outOf);

          const _top = ranking ? `TOP ${_percentage || "?"}%` : "";

          const brokenRanking = false; // outOf < 10000;

          const topBadge = brokenRanking ? (
            ""
          ) : (
            <span className="lb-badge" style={{ marginRight: 5 }}>
              <span>{_top}</span>
            </span>
          );

          const lbBadge = (
            <span className="lb-badge with-icon">
              <img alt="" className="weapon-icon" src={calc.weapon.icon} />
              <span>
                {short}{" "}
                {variant?.displayName?.replace("C6", "").replace("C2", "")}
              </span>
            </span>
          );

          const thisChartData = chartsData?.charts1pMetadata?.find(
            (x: any) => x.calculationId === id
          );

          const rankingPill = brokenRanking ? (
            <div>rank unavailable</div>
          ) : (
            <div>
              {ranking ?? (
                <span title="Rankings are cached. If you see this you need to refresh the page">
                  -
                </span>
              )}
              <span className="opacity-5">/{outOf || "???"}</span>
            </div>
          );

          return (
            <div key={id}>
              <div>{displayCharts(thisChartData, id)}</div>
              <div className="under-chart">
                <TeammatesCompact
                  teammates={calc.teammates}
                  scale={1.7 * hardcodedScale}
                />
                <span className="under-chart-badges">
                  <div className="mobile-fix w-100">
                    <div className="mobile-fix">
                      {topBadge}
                      {lbBadge}
                    </div>
                  </div>
                </span>
                {/* <div>{shorterName}</div> */}
                {privacyFlag ? "" : rankingPill}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [
    privacyFlag,
    chartsData,
    filteredLeaderboards,
    generating,
    translate,
    getTopRanking,
  ]);

  const reorderedArtifacts = useMemo(
    () => getArtifactsInOrder(artifacts, true),
    [JSON.stringify(artifacts)]
  );

  const compactList = useMemo(() => {
    const namecardBgUrl = toEnkaUrl(chartsData?.characterMetadata?.namecard);
    const elementalBgUrl = `/elementalBackgrounds/${chartsData?.characterMetadata?.element}-bg.jpg`;
    const actualBgUrl = namecardBg ? namecardBgUrl : elementalBgUrl;

    return (
      <div className="mobile-fix w-100 justify-content-center">
        <div className="mobile-fix">
          {reorderedArtifacts.map((artifact: any) => {
            return (
              <CompactArtifact
                key={artifact._id}
                artifact={artifact}
                row={row}
                canvasBgProps={{
                  backgroundImage: actualBgUrl,
                  adaptiveBgColor: _adaptiveBgColor,
                  namecardBg,
                  adaptiveColors,
                  hardcodedScale,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }, [
    row,
    metric,
    chartsData,
    namecardBg,
    simplifyColors,
    _adaptiveBgColor,
    customRvFilter[row.name]?.length,
    JSON.stringify(reorderedArtifacts),
    JSON.stringify(adaptiveColors),
  ]);

  const paintImageToCanvas = useCallback(
    async (
      result: string,
      mode?: string | boolean,
      coldStart?: boolean,
      pointerPos?: Coords | null,
      noDrag: boolean = false
    ) => {
      if (!canvasBgRef?.current) return;
      if (!backgroundPictureRef?.current) return;

      const characterImg = backgroundPictureRef?.current;

      characterImg.crossOrigin = "anonymous";
      // const isCustomBg = mode !== "gacha";
      const _result = result + "";
      characterImg.src = _result;

      const namecardBgUrl = toEnkaUrl(chartsData?.characterMetadata?.namecard);
      const elementalBgUrl = `/elementalBackgrounds/${chartsData?.characterMetadata?.element}-bg.jpg`;
      const actualBgUrl = namecardBg ? namecardBgUrl : elementalBgUrl;

      const elementalOrNamecardBgImg = new Image();
      elementalOrNamecardBgImg.crossOrigin = "anonymous";
      elementalOrNamecardBgImg.src = actualBgUrl;

      const bgWidth = canvasPixelDensity * canvasBgWidth;
      const bgHeight = canvasPixelDensity * canvasBgHeight;

      const backgroundCtx = canvasBgRef?.current?.getContext("2d");

      const drawBackground = async (i = 0) => {
        if (!canvasBgRef.current) return;
        if (i > 5) {
          cardErrorCallback();
          return;
        }

        // clear canvas
        backgroundCtx!.globalCompositeOperation = "source-out";
        backgroundCtx!.clearRect(0, 0, bgWidth, bgHeight);
        backgroundCtx!.filter = "contrast(100%)";

        try {
          if (namecardBg) {
            const namecardHeight = canvasPixelDensity * 572;
            const yOffset = -(namecardHeight - bgHeight);
            backgroundCtx!.drawImage(
              elementalOrNamecardBgImg,
              0,
              yOffset,
              bgWidth,
              namecardHeight
            );
          } else {
            backgroundCtx!.drawImage(
              elementalOrNamecardBgImg,
              0,
              0,
              bgWidth,
              bgHeight
            );
          }
        } catch (err) {
          console.log(err);
          await delay(10);
          await drawBackground(i + 1);
        }

        // return backgroundCtx;
      };

      const images = [characterImg, elementalOrNamecardBgImg];

      const allPromises = images.map((image: any) => {
        if (!image) return new Promise((resolve) => resolve(true));

        return new Promise((resolve) => {
          image.onload = async () => {
            if (coldStart) {
              await delay(10);
              await drawBackground();
            }
            resolve(true);
          };
          image.onerror = async () => {
            resolve(true);
          };
        });
      });

      await Promise.all(allPromises);
      await drawBackground();

      if (coldStart) {
        await delay(10);
      }

      if (characterImg.classList.contains("invalid-picture")) return;

      // characterImg.onload = () => resolve()
      // elementalOrNamecardBgImg.onload = () => resolve()

      if (!canvasRef.current) return;

      // Once the image is loaded, we will get the width & height of the image

      const imageWidth = characterImg.width;
      const imageHeight = characterImg.height;

      // width    2048
      // height   1024

      const _canvasWidth = mode === "gacha" ? canvasWidth * 1.55 : canvasWidth;
      const _canvasHeight =
        mode === "gacha" ? canvasHeight * 1.55 : canvasHeight;

      // get the scale
      // it is the min of the 2 ratios
      const canvasScale =
        Math.max(_canvasWidth / imageWidth, _canvasHeight / imageHeight) *
        zoomLevel;

      // Finding the new width and height based on the scale factor
      const newWidth = imageWidth * canvasScale;
      const newHeight = imageHeight * canvasScale;

      setImgDimensions({
        x: newWidth,
        y: newHeight,
      });

      // get canvas context
      const characterCtx = canvasRef.current.getContext("2d");

      // Create gradient
      const gradientMask = characterCtx!.createLinearGradient(
        canvasWidth - 101 * hardcodedScale,
        0,
        canvasWidth - 3 * hardcodedScale,
        0
      );
      gradientMask.addColorStop(0, "black");
      gradientMask.addColorStop(1, "transparent");

      // clear canvas
      characterCtx!.globalCompositeOperation = "source-out";
      characterCtx!.clearRect(0, 0, canvasWidth, canvasHeight);

      // Fill with gradient
      characterCtx!.fillStyle = skipGradient ? "black" : gradientMask;
      characterCtx!.fillRect(0, 0, canvasWidth, canvasHeight);

      // get the top left position of the image
      // in order to center the image within the canvas
      let x = _canvasWidth / 2 - newWidth / 2;
      let y = _canvasHeight / 2 - newHeight / 2;

      if (mode === "gacha") {
        if (row.name === "Traveler") {
          x = x - 100 * hardcodedScale;
          y = y + 30 * hardcodedScale;
        } else {
          x = x - 130 * hardcodedScale;
          y = y - 82 * hardcodedScale;
        }
      }

      if (!noDrag && !pointerPos && dragOffset) {
        // this triggers on zoom and image config changes
        x += dragOffset.x;
        y += dragOffset.y;
      } else if (dragOffset && !noDrag) {
        // this triggers on mouseMove
        x -= dragOffset.x;
        y -= dragOffset.y;
      }

      const boundaries = {
        x1: 0,
        x2: -(newWidth - canvasWidth),
        y1: 0,
        y2: -(newHeight - canvasHeight),
      };

      if (pointerPos) {
        x += pointerPos?.x;
        y += pointerPos?.y;
      }

      // handle horizontal overflow
      if (x > boundaries.x1) {
        x = boundaries.x1;
      } else if (x < boundaries.x2) {
        x = boundaries.x2;
      }

      // handle vertical overflow
      if (y > boundaries.y1) {
        y = boundaries.y1;
      } else if (y < boundaries.y2) {
        y = boundaries.y2;
      }

      characterCtx!.globalCompositeOperation = "source-in";
      characterCtx!.drawImage(characterImg, x, y, newWidth, newHeight);

      if (!_adaptiveBgColor) return;

      const getRightEdgeData = async (i = 0) => {
        if (i > 5) {
          cardErrorCallback();
          return;
        }

        try {
          return characterCtx!.getImageData(
            Math.floor(canvasWidth * 2 - 25), // newWidth - 1, // start X
            0, // start Y
            1, // width of extracted data
            Math.floor(2 * canvasHeight - 1) // height of extracted data
          );
        } catch (err) {
          console.log(err);
          await delay(10);
          getRightEdgeData(i + 1);
        }
      };

      const rightEdgeData: any = await getRightEdgeData();

      if (!rightEdgeData) return;

      // Create gradient
      const gradientCoords = [0, 0, 0, bgHeight] as const;
      const adaptiveGradient_1 = backgroundCtx!.createLinearGradient(
        ...gradientCoords
      );

      const gradientSteps = 2;

      const setGradientFromImageDefault = (
        gradient: CanvasGradient,
        alphaOverride: string | number = "55"
      ) => {
        return setGradientFromImage(
          gradient,
          2 * canvasHeight,
          canvasWidth,
          rightEdgeData,
          gradientSteps,
          alphaOverride,
          characterCtx
        );
      };

      const solidGradientColors = setGradientFromImageDefault(
        adaptiveGradient_1,
        "ff"
      );

      backgroundCtx!.globalCompositeOperation = "color";
      backgroundCtx!.fillStyle = adaptiveGradient_1;
      backgroundCtx!.fillRect(0, 0, bgWidth, bgHeight);

      // Create gradient
      const adaptiveGradient_2 = backgroundCtx!.createLinearGradient(
        ...gradientCoords
      );

      // "multiply"
      // "overlay"
      // "color-dodge"
      // "color-burn"
      // "hard-light"
      // "soft-light"
      // "hue"
      // "color"

      const nonSolidGradientColors = setGradientFromImageDefault(
        adaptiveGradient_2,
        "55"
      );

      setAdaptiveColors([solidGradientColors, nonSolidGradientColors]);

      backgroundCtx!.globalCompositeOperation = "hard-light";
      backgroundCtx!.fillStyle = adaptiveGradient_2;
      backgroundCtx!.filter = "contrast(150%)";
      // backgroundCtx!.filter = "contrast(150%)";
      backgroundCtx!.fillRect(0, 0, bgWidth, bgHeight);
    },
    [
      canvasBgRef,
      backgroundPictureRef,
      chartsData,
      _adaptiveBgColor,
      hasCustomBg,
      namecardBg,
      dragOffset,
      zoomLevel,
      skipGradient,
    ]
  );

  const throttledPaintImageToCanvas = useCallback(
    throttle(
      (
        result: string,
        mode?: string | boolean,
        coldStart?: boolean,
        pointerPos?: Coords,
        noDrag?: boolean
      ) => paintImageToCanvas(result, mode, coldStart, pointerPos, noDrag),
      isMobile ? 33 : 17
      //  5 ms =   200 fps // <-- seems to lag on mobile?
      //  8 ms = ~ 120 fps
      // 10 ms =   100 fps
      // 17 ms = ~  60 fps
      // 33 ms = ~  30 fps
    ),
    [paintImageToCanvas, isMobile]
  );

  const characterShowcase = useMemo(() => {
    const charImgUrl = toEnkaUrl(chartsData?.assets?.gachaIcon);
    const showcaseContainerClassNames = cssJoin([
      "character-showcase-pic-container",
      toggleConfigure ? "editable" : "",
      isDragging ? "is-dragging" : "",
      hasCustomBg, // "horizontal", "vertical" or ""
      row.name === "Traveler" ? "is-traveler" : "",
      generating ? "is-generating" : "",
      charImgUrl ? "" : "disable-input",
    ]);

    const paintMode =
      !customCardPic && !uploadPictureInputRef?.current?.files?.[0] && "gacha";

    const onContainerMouseDown = (event: MouseOrTouchEvent) => {
      if (!toggleConfigure) return;

      setIsDragging(true);
      const { x, y } = getCoordsFromEvent(event);

      setDragOffset((prev) => ({
        x: x - (prev?.x || 0),
        y: y - (prev?.y || 0),
      }));
    };

    const onContainerMouseUp = (event: MouseOrTouchEvent) => {
      if (!isDragging || !toggleConfigure || !compressedImage) return;

      setIsDragging(false);
      const { x, y } = getCoordsFromEvent(event);

      let freedomX = (imgDimensions.x - canvasWidth) / 2;
      let freedomY = (imgDimensions.y - canvasHeight) / 2;

      let offsetX = 0;
      let offsetY = 0;

      if (dragOffset) {
        if (paintMode === "gacha") {
          if (row.name === "Traveler") {
            freedomX = 160;
            freedomY = 370;
          } else {
            freedomX = 510;
            freedomY = 158;
          }
        }

        const vectorX = dragOffset.x - x;
        const vectorY = dragOffset.y - y;
        const isHorizontal = Math.abs(vectorX) > freedomX;
        const isVertical = Math.abs(vectorY) > freedomY;

        if (isVertical) {
          if (vectorY < 0) {
            // leak top
            const _y = imgDimensions.y / 2 + vectorY;
            offsetY = (2 * _y - canvasHeight) / 2;
          } else if (vectorY > 0) {
            // leak bottom
            const _y = imgDimensions.y / 2 + vectorY;
            offsetY = -(2 * freedomY - (2 * _y - canvasHeight) / 2);
          }
        }

        // leak left
        if (isHorizontal) {
          if (vectorX < 0) {
            // leak left
            const _x = imgDimensions.x / 2 + vectorX;
            offsetX = (2 * _x - canvasWidth) / 2;
          } else if (vectorX > 0) {
            // leak right
            const _x = imgDimensions.x / 2 + vectorX;
            offsetX = -(2 * freedomX - (2 * _x - canvasWidth) / 2);
          }
        }
      }

      setDragOffset((prev) => ({
        x: x - (prev?.x || 0) + offsetX,
        y: y - (prev?.y || 0) + offsetY,
      }));
    };

    const onContainerMouseMove = (event: MouseOrTouchEvent) => {
      if (!isDragging || !toggleConfigure || !compressedImage) return;

      const pos = getCoordsFromEvent(event);
      throttledPaintImageToCanvas(compressedImage, paintMode, false, pos);
    };

    const onContainerClick = () => {
      setToggleConfigure(true); // enable zoom and upload pic buttons
    };

    const onFileUpload = () => {
      const file = uploadPictureInputRef?.current?.files?.[0];
      if (!file) return;

      // const mp4blob = URL.createObjectURL(file);

      try {
        setIsLoadingImage(true);
        const reader = new FileReader();

        reader.addEventListener(
          "load",
          async () => {
            const dataURL = await compressPNG(
              reader.result + "",
              canvasWidth,
              canvasHeight,
              2
            );

            setDragOffset(null);
            setZoomLevel(1);
            setCompressedImage(dataURL);
            paintImageToCanvas(dataURL, false, false, null, true);
            setHasCustomBg("horizontal");
            setIsLoadingImage(false);
          },
          false
        );

        reader.readAsDataURL(file);
      } catch (err) {
        console.log(err);
        setIsLoadingImage(false);
      }
    };

    return (
      <div>
        <div className="column-shadow-gradient-top" />
        <div className="column-shadow-gradient-left" />
        <div className="column-shadow-gradient-bottom" />
        {/* <div className="column-shadow-gradient" /> */}

        <div
          style={{ pointerEvents: "all" }}
          className={showcaseContainerClassNames}
          // desktop support
          onMouseUp={onContainerMouseUp}
          onMouseDown={onContainerMouseDown}
          onMouseMove={onContainerMouseMove}
          onMouseOut={onContainerMouseUp} // same as mouse up
          // mobile support
          onTouchEnd={onContainerMouseUp}
          onTouchStart={onContainerMouseDown}
          onTouchMove={onContainerMouseMove}
          // onTouchCancel={onContainerMouseUp} // same as touch up
          onClick={onContainerClick}
        >
          <input
            ref={uploadPictureInputRef}
            type="file"
            name="filename"
            style={{ display: "none", pointerEvents: "all" }}
            onChange={onFileUpload}
          />
          <canvas
            key={`canvas-img-${buildId}`} // just to make sure
            width={canvasWidth * canvasPixelDensity}
            height={canvasHeight * canvasPixelDensity}
            style={{
              width: canvasWidth,
              height: canvasHeight,
            }}
            ref={canvasRef}
          />
          {isLoadingImage && (
            <div className="image-loading-wrapper">
              {charImgUrl ? <Spinner /> : "Something went wrong :("}
            </div>
          )}
          <img
            alt=""
            className={charImgUrl ? "" : "invalid-picture"}
            style={{ display: "none" }}
            ref={backgroundPictureRef}
            src={customCardPic ? cardPicUrl : charImgUrl}
          />
        </div>
      </div>
    );
  }, [
    row,
    uploadPictureInputRef,
    backgroundPictureRef,
    canvasRef,
    hasCustomBg,
    generating,
    isLoadingImage,
    chartsData,
    hardcodedScale,
    isDragging,
    compressedImage,
    imgDimensions,
    zoomLevel,
    dragOffset,
    toggleConfigure,
    customCardPic,
  ]);

  const characterStats = useMemo(
    () => (
      <div className="character-stats-inside">
        <StatListCard row={row} />
      </div>
    ),
    [row]
  );

  const characterMiddle = useMemo(() => {
    const baseAttack = chartsData?.weaponMetadata?.baseAttack || 0;
    const mainstat = chartsData?.weaponMetadata?.mainstat;
    const mainstatName = STAT_NAMES[mainstat?.name];
    const isPercentage = isPercent(mainstatName);

    const weaponName = translate(row.weapon.name);
    const refinementValue =
      (row.weapon.weaponInfo?.refinementLevel?.value ?? 0) + 1;

    const statIconSize = 16;

    return (
      <div className="character-middle-fix">
        <div className="character-weapon relative">
          <div className="weapon-icon">
            <img alt="" src={row.weapon.icon} />
            <div className="weapon-rarity">
              {[...Array(chartsData?.weaponMetadata?.rarity)].map((e, i) => (
                <img alt="*" key={`star-${i}`} src={RarityStar} />
              ))}
            </div>
          </div>
          <div className="weapon-data">
            <div className="weapon-name">{weaponName}</div>
            <div className="weapon-stats lighter-color">
              <div className="weapon-stat-with-icon">
                <StatIcon sizeOverride={statIconSize} name="ATK" /> {baseAttack}
              </div>
              <div className="weapon-stat-with-icon">
                <StatIcon sizeOverride={statIconSize} name={mainstatName} />{" "}
                {mainstat?.value}
                {isPercentage ? "%" : ""}
              </div>
            </div>
            <div className="weapon-stats">
              <div className="weapon-refinement">R{refinementValue}</div>
              <div>
                <span>
                  {translate("Lv.")} {row.weapon.weaponInfo.level}
                </span>
                <span className="opacity-5">
                  /
                  {ascensionToLevel(
                    row.weapon.weaponInfo?.promoteLevel,
                    "weapon",
                    row.weapon.weaponInfo.level
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        {characterStats}
        {/* <div className="card-leaderboards relative">{leaderboardHighlighs}</div> */}
      </div>
    );
  }, [row, chartsData, translate]);

  const renderOptions = useCallback(
    (calcId: any) => {
      const c = calculations[calcId];
      if (!c) {
        return {
          label: (
            <span
              style={{ marginLeft: 5 }}
              className="react-select-custom-option"
            >
              Don't show any ranking
            </span>
          ),
          rawLabel: "Don't show any ranking",
          value: "hide",
          fieldKey: "hide",
          top: -1,
          priority: -1,
        };
      }
      const leaveOnlyNumbersRegex = /\D+/g;
      const _ranking = +(c.ranking + "")?.replace(leaveOnlyNumbersRegex, "");

      const _top = c.ranking
        ? `${getTopRanking(_ranking, c.outOf) || "?"}%`
        : "";

      const shorterName =
        c.name.length > 85 ? `${c.name.slice(0, 82)}...` : c.name;

      const label = (
        <>
          <span className="react-select-custom-option">
            <span className="for-dropdown">
              <WeaponMiniDisplay
                icon={c.weapon.icon}
                refinement={c.weapon.refinement}
              />
              <div
                style={{
                  width: 150,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {translate(c.weapon.name)}
              </div>
              <div style={{ width: 80 }}>top {_top}</div>
              {c.variant?.displayName
                ? `(${c.variant?.displayName}) `
                : ""}{" "}
              {shorterName}
            </span>
            <span className="for-pills">
              <img alt="" src={c.weapon.icon} />
              {translate(c.weapon.name)} - top {_top}{" "}
              {c.variant?.displayName ? `(${c.variant?.displayName}) ` : " "}
              {c.short}
            </span>
          </span>
        </>
      );

      const rawLabel = `top ${_top} ${c.weapon.name} R${c.weapon.refinement} ${
        c.name
      }${c.variant?.displayName ? ` ${c.variant?.displayName}` : ""}`;

      const thisOpt = {
        label,
        rawLabel,
        value: calcId,
        fieldKey: calcId,
        top: _ranking / c.outOf,
        priority: c.priority,
      };

      return thisOpt;
    },
    [calculations, translate, getTopRanking]
  );

  const calcOptions = useMemo(
    () =>
      calculations && Object.keys(calculations).length > 0
        ? ["", ...Object.keys(calculations)]
            .filter((key: any) => !calculations?.[key]?.hidden)
            .map(renderOptions)
            .sort((a, b) => {
              // return b.priority - a.priority || a.top - b.top;
              return a.top > b.top ? 1 : -1;
            })
        : [],
    [calculations, translate]
  );

  const cardOverlay = useMemo(() => {
    const talentSkillProps = toTalentProps(row, ["elementalSkill"], chartsData);
    const talentBurstProps = toTalentProps(row, ["elementalBurst"], chartsData);
    const talentNAProps = toTalentProps(
      row,
      ["normalAttacks", "normalAttack"],
      chartsData
    );

    return (
      <>
        <div key="character-name" className="character-name">
          <div>
            {displayBuildName
              ? row.type !== "current"
                ? row.type
                : translate(row.name)
              : translate(row.name, getGenderFromIcon(row.icon))}
          </div>
          {!privacyFlag && (
            <div className="character-nickname">{row.owner.nickname}</div>
          )}
        </div>
        {/* 
          <div className="character-title">{chartsData?.characterMetadata?.title}</div>
          <div className="character-title">{chartsData?.characterMetadata?.constellation}</div> 
          */}
        <div className="character-level">
          {translate("Lv.")} {row.propMap.level.val}
          <span className="opacity-5">
            /{ascensionToLevel(row.propMap.ascension.val, "character")}
          </span>
        </div>
        <div className="character-friendship">
          <img alt="friendship" src={FriendshipIcon} />{" "}
          {row.fetterInfo.expLevel}
        </div>
        <div className="character-cv">{fixCritValue(row)} cv</div>
        {!privacyFlag && (
          <div key="character-uid" className="character-uid">
            {row.uid}
          </div>
        )}
        <div className="character-constellations">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const constImg = chartsData?.assets?.constellations?.[i];
            const isActivated = row.constellation >= i + 1;
            return (
              <div
                key={`${constImg}-${i}`}
                className={isActivated ? "activated" : ""}
              >
                {!isActivated && (
                  <span className="const-locked">
                    <FontAwesomeIcon
                      className="lock-icon"
                      icon={faLock}
                      size="1x"
                    />
                  </span>
                )}
                {constImg ? (
                  <img
                    alt=" "
                    key={`const-${i}`}
                    className={isActivated ? "activated" : ""}
                    src={toEnkaUrl(constImg)}
                  />
                ) : (
                  <div className="no-const" />
                )}
              </div>
            );
          })}
        </div>
        <div className="character-talents">
          <TalentDisplay talent={talentNAProps} />
          <TalentDisplay talent={talentSkillProps} />
          <TalentDisplay talent={talentBurstProps} />
        </div>
      </>
    );
  }, [
    row,
    chartsData,
    privacyFlag,
    displayBuildName,
    toggleConfigure,
    translate,
  ]);

  const cardOverlayWrapper = useMemo(() => {
    const paintMode =
      !customCardPic && !uploadPictureInputRef?.current?.files?.[0] && "gacha";
    const zoomIncrement = 1.05;
    const arrowSize = 2;

    const displayArrows = (
      <div className="drag-arrows">
        <FontAwesomeIcon
          icon={faArrowLeft}
          size={`${arrowSize}x`}
          style={{
            top: 137,
            left: 92,
          }}
        />
        <FontAwesomeIcon
          icon={faArrowRight}
          size={`${arrowSize}x`}
          style={{
            top: 137,
            left: 392,
          }}
        />
        <FontAwesomeIcon
          icon={faArrowUp}
          size={`${arrowSize}x`}
          style={{
            top: 92,
            left: 242,
          }}
        />
        <FontAwesomeIcon
          icon={faArrowDown}
          size={`${arrowSize}x`}
          style={{
            top: 187,
            left: 242,
          }}
        />
      </div>
    );

    const displayZoomButtons = (
      <div className="zoom-level-buttons">
        <div
          className="single-config-button"
          title="Zoom in"
          onClick={() => {
            // no limits on zooming in
            setZoomLevel((prev) => prev * zoomIncrement);
          }}
        >
          <FontAwesomeIcon icon={faPlus} size={`1x`} />
        </div>
        <div
          className="single-config-button"
          title="Zoom out"
          onClick={() => {
            // zoom out limit so we never see edges of the images
            const minZoomLevel = paintMode === "gacha" ? 0.64 : 1;

            if (imgDimensions.x / zoomIncrement < canvasWidth) {
              setZoomLevel(minZoomLevel);
            } else if (imgDimensions.y / zoomIncrement < canvasHeight) {
              setZoomLevel(minZoomLevel);
            } else {
              setZoomLevel((prev) => prev / zoomIncrement);
            }
          }}
        >
          <FontAwesomeIcon icon={faMinus} size={`1x`} />
        </div>
        <div
          className="single-config-button"
          title="Reset zoom & position"
          onClick={() => {
            setZoomLevel(1);
            setDragOffset(null);

            // if zoomLevel doesn't change then force canvas re-paint
            if (zoomLevel === 1 && compressedImage) {
              paintImageToCanvas(compressedImage, paintMode, false, null, true);
            }
          }}
        >
          <FontAwesomeIcon icon={faRefresh} size={`1x`} />
        </div>
      </div>
    );

    const displayTopButtons = (
      <div className="top-buttons">
        <div
          title="Upload image"
          onClick={() => {
            uploadPictureInputRef?.current?.click();
          }}
        >
          <FontAwesomeIcon icon={faImage} size={`2x`} />
          Upload image...
        </div>
        <div
          className="single-config-button"
          title="Exit edit mode"
          onClick={() => {
            setToggleConfigure(false);
          }}
        >
          <FontAwesomeIcon icon={faCheck} size={`1x`} />
        </div>
      </div>
    );

    return (
      <>
        {toggleConfigure && (
          <div
            className="config-overlay"
            style={{
              opacity: isDragging ? 0.33 : 1,
              display: generating ? "none" : "block",
            }}
          >
            {displayArrows}
            {displayZoomButtons}
            {displayTopButtons}
          </div>
        )}

        <div
          className="absolute-overlay"
          style={{
            opacity: toggleConfigure && !generating ? 0.33 : 1,
          }}
        >
          {cardOverlay}
        </div>
      </>
    );
  }, [
    row,
    chartsData,
    privacyFlag,
    displayBuildName,
    toggleConfigure,
    compressedImage,
    zoomLevel,
    isDragging,
    generating,
    uploadPictureInputRef,
    imgDimensions, // ?
    translate,
    customCardPic,
  ]);

  const handleSelectChange = (option: any) => {
    setFilteredLeaderboards([option.value]);
  };

  const selectedOptions = useMemo(() => {
    return calcOptions.filter((calc) => {
      return filteredLeaderboards.includes(calc.value);
    });
  }, [filteredLeaderboards, calcOptions]);

  const handleGenerateAndDownload = async (
    mode: "download" | "open",
    event: any
  ) => {
    const cardNode = document.getElementById(buildId);
    if (!cardNode) return;

    const _opts: Partial<Options> = {
      scale: 1.75,
      // width: 1806,
      // height: 853,
      backgroundColor: null, // transparent
      allowTaint: true,
      useCORS: true,
      onclone: (document, element) => {
        const offsetElementBy = (
          selector: string,
          transform: number | string
          // transform?: string
        ) => {
          element.querySelectorAll(selector).forEach((el: any) => {
            el.style.transform = isNaN(+transform)
              ? transform
              : `translateY(${transform}px)`;
          });
        };

        // un-scale
        (element.style as any)["--scale-factor"] = "1";

        offsetElementBy(".character-talents .talent-display-value", 0); // ???
        offsetElementBy(".character-talents .talent-display-value > span", -1);
        offsetElementBy(".roll-list-member > span > span", -1);
        offsetElementBy(".roll-list-member > span > span > img", 1); // offset img
        offsetElementBy(
          ".character-artifacts .compact-artifact-main-stat > span",
          -1
        );
        offsetElementBy(".lb-badge > span", -1);
        // offsetElementBy(".compact-artifact-crit-value > span", -2);
        // offsetElementBy(".compact-artifact-crit-value > .smol-percentage", -2);
        offsetElementBy(
          ".compact-artifact-crit-value > span:not(.metric-formula)",
          -1
        );
        offsetElementBy(".table-stat-row span", -1);
        offsetElementBy(".table-stat-row > div:not(.flex)", -1);

        offsetElementBy(
          ".compact-artifact-subs .substat > span:last-child",
          -1
        );

        offsetElementBy(
          ".roll-dots",
          `translateX(calc(-100% - 3px)) translateY(-1px)`
        );
      },
    };

    const genDelay = 100; // 100ms

    try {
      if (mode === "download") {
        setGenerating("downloading");

        await delay(genDelay);
        const canvas = await html2canvas(cardNode, _opts);
        const dataUrl = canvas.toDataURL("image/png", 1.0);

        if (!dataUrl) return;

        const _link = document.createElement("a");
        _link.download = `${row.name}-${row._id}.png`;
        _link.href = dataUrl;
        _link.click();
      }

      if (mode === "open") {
        setGenerating("opening");

        await delay(genDelay);
        const canvas = await html2canvas(cardNode, _opts);

        canvas.toBlob((blob) => {
          if (!blob) return;
          setImagePreviewBlob(blob);
          handleToggleModal(event);
        });
      }
    } catch (err) {
      console.log(err);
    }
    setGenerating(false);
  };

  const charImgUrl = toEnkaUrl(chartsData?.assets?.gachaIcon);

  const cardContainerClassNames = cssJoin([
    "character-card-container",
    !namecardBg ? "elemental-bg-wrap" : "",
    simplifyColors ? "simplify-colors" : "",
    hasLeaderboardsColumn ? "" : "no-leaderboards",
    charImgUrl ? "" : "disable-input",
    toggleConfigure ? "editable" : "",
    generating ? "is-generating" : "",
  ]);

  const cardStyle = {
    "--element-color": elementalColor || noElementColor,
    "--element-color-2": `${elementalColor || noElementColor}70`,
  } as React.CSSProperties;

  const handleCardPicUpload = async (clear: boolean = false) => {
    setUploading(true);
    if (!clear) setSkipGradient(true);
    await delay(150);

    canvasRef.current?.toBlob(async (blob) => {
      if (!blob) return;
      if (!clear) setSkipGradient(false);

      const { uid, md5 } = row;
      const _uid = encodeURIComponent(uid);
      const _md5 = encodeURIComponent(md5);

      const formData = new FormData();
      formData.append("file", blob, "cardpic.png");

      const postNamecardURL = `/api/user/cardpic/${_uid}/${_md5}`;

      try {
        let _formData: any = formData;
        const opts: AxiosRequestConfig<any> = {
          headers: {
            Authorization: `Bearer ${getSessionIdFromCookie()}`,
            "Content-Type": "multipart/form-data",
          },
          params: {
            variant: _adaptiveBgColor ? "adaptiveBg" : "",
          },
        };

        if (clear) {
          _formData = null;
          delete opts.headers?.["Content-Type"];
        }

        const response = await axios.post(postNamecardURL, _formData, opts);

        setCustomCardPic(response?.data?.filename);
        setPicLoaded(false);
        setUploading(false);

        // clear image from the input
        if (uploadPictureInputRef.current) {
          uploadPictureInputRef.current.value = "";
        }

        // clear the file from input element
        if (clear) {
          setCompressedImage("");
        }

        // invalidate cache
        invalidateCache && invalidateCache();
      } catch (err) {
        console.log(err);
        setUploading(false);
      }
    });
  };

  return (
    <div
      className="flex expanded-row relative mb-0 scale-factor-source"
      style={wrapperStyle}
    >
      <PreviewModal
        isOpen={showPreviewModal}
        toggleModal={handleToggleModal}
        blob={imagePreviewBlob}
        // dataURL={imagePreviewBlob}
      />
      <div className="card-wrapper-height-fix">
        <div
          id={buildId}
          className={cssJoin([
            "card-wrapper relative",
            DEBUG_MODE ? "debug" : "",
          ])}
        >
          <div className="html-to-image-target">
            <div className={cardContainerClassNames} style={cardStyle}>
              {cardOverlayWrapper}
              <div className="character-left">{characterShowcase}</div>
              <div className="character-middle">{characterMiddle}</div>
              <div className="character-right">{leaderboardHighlighs}</div>
              <div className="character-artifacts">{compactList}</div>
              <div className="character-artifacts-rv">
                <RollList artifacts={reorderedArtifacts} character={row.name} />
              </div>
              <div
                className={`character-card-background ${
                  !namecardBg ? "elemental-bg" : ""
                }`}
              >
                <canvas
                  key={`canvas-${buildId}`} // just to make sure
                  className="bg-as-canvas"
                  ref={canvasBgRef}
                  width={canvasBgWidth * canvasPixelDensity}
                  height={canvasBgHeight * canvasPixelDensity}
                  style={{
                    width: canvasBgWidth,
                    height: canvasBgHeight,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="card-buttons-wrapper">
        <div className="card-buttons">
          <div className="card-configuration">
            <div className="buttons-row">
              {generating === "downloading" ? (
                <>
                  <Spinner />
                </>
              ) : (
                <button
                  className={cssJoin([
                    "dl-button",
                    generating ? "opacity-5" : "",
                  ])}
                  disabled={generating ? true : false}
                  onClick={(event) =>
                    handleGenerateAndDownload("download", event)
                  }
                >
                  <FontAwesomeIcon
                    className="filter-icon hoverable-icon"
                    icon={faDownload}
                    size="1x"
                    title="Download"
                  />
                  Download
                </button>
              )}
              {generating === "opening" ? (
                <>
                  <Spinner />
                </>
              ) : (
                <button
                  className={cssJoin([
                    "dl-button",
                    generating ? "opacity-5" : "",
                  ])}
                  disabled={generating ? true : false}
                  onClick={(event) => handleGenerateAndDownload("open", event)}
                >
                  <FontAwesomeIcon
                    className="filter-icon hoverable-icon"
                    icon={faMagnifyingGlass}
                    size="1x"
                    title="Open"
                  />
                  Open
                </button>
              )}
              <button
                className={toggleConfigure ? "toggled-conf-btn" : ""}
                onClick={() => {
                  setToggleConfigure((prev) => !prev);
                }}
              >
                <FontAwesomeIcon
                  className="filter-icon hoverable-icon"
                  icon={faCog}
                  size="1x"
                  title="Configure"
                />
                Configure Image
              </button>

              {isAccountOwner &&
                (uploading ? (
                  <Spinner />
                ) : (
                  <>
                    {picLoaded && (
                      <button
                        onClick={() => handleCardPicUpload(false)}
                        title={showPicSaveButton ? "" : "Patreon only feature"}
                        disabled={!showPicSaveButton}
                      >
                        <FontAwesomeIcon
                          className="filter-icon hoverable-icon"
                          icon={faUpload}
                          size="1x"
                          title="Upload"
                        />
                        Upload image to Akasha{" "}
                        <span>Note: images must be SFW</span>
                      </button>
                    )}
                    {showPicSaveButton && customCardPic && (
                      <button onClick={() => handleCardPicUpload(true)}>
                        <FontAwesomeIcon
                          className="filter-icon hoverable-icon"
                          icon={faX}
                          size="1x"
                          title="Delete"
                        />
                        Delete image from Akasha
                      </button>
                    )}
                  </>
                ))}
            </div>

            {toggleConfigure ? (
              <div className="expanded-row toggle-config">
                <div
                  className={`card-select-wrapper ${
                    calcOptions.length === 0 ? "no-calcs" : ""
                  }`}
                >
                  <span className="card-select-label">Highlighted ranking</span>
                  <div className="card-select ">
                    <div className="react-select-calcs-wrapper">
                      <ReactSelect
                        isDisabled={calcOptions.length === 0}
                        // isMulti
                        options={calcOptions}
                        menuPortalTarget={document.body}
                        styles={reactSelectCustomFilterTheme}
                        maxMenuHeight={450}
                        menuPlacement="auto"
                        getOptionValue={(option: any) => option.rawLabel}
                        placeholder={
                          calcOptions.length === 0
                            ? "No leaderboards available"
                            : "Choose leaderboards"
                        }
                        value={selectedOptions?.[0]}
                        defaultValue={selectedOptions?.[0]}
                        onChange={(options) => {
                          if (!options) return;
                          handleSelectChange(options);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="card-checkboxes">
                  <div>
                    <label htmlFor={`${buildId}-bname`}>
                      Display build name
                    </label>
                    <input
                      id={`${buildId}-bname`}
                      type="checkbox"
                      checked={displayBuildName}
                      onChange={(e: any) =>
                        setDisplayBuildName(!!e.target.checked)
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor={`${buildId}-sc`}>
                      Simplify border colors
                    </label>
                    <input
                      id={`${buildId}-sc`}
                      type="checkbox"
                      checked={simplifyColors}
                      onChange={(e: any) =>
                        setSimplifyColors(!!e.target.checked)
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor={`${buildId}-abg`}>
                      Adaptive background
                    </label>
                    <input
                      id={`${buildId}-abg`}
                      type="checkbox"
                      checked={_adaptiveBgColor}
                      onChange={(e: any) => {
                        _setAdaptiveBgColor(!!e.target.checked);
                        setAdaptiveBgColor(!!e.target.checked);
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${buildId}-nb`}>Namecard background</label>
                    <input
                      id={`${buildId}-nb`}
                      checked={namecardBg}
                      type="checkbox"
                      onChange={(e: any) => setNamecardBg(!!e.target.checked)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${buildId}-hr`}>Hide UID & ranking</label>
                    <input
                      id={`${buildId}-hr`}
                      checked={privacyFlag}
                      type="checkbox"
                      onChange={(e: any) => setPrivacyFlag(!!e.target.checked)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
