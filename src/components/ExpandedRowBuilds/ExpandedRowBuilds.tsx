import React, { useEffect, useState } from "react";

import { ArtifactListCompact } from "../ArtifactListCompact";
import { CalculationList } from "../CalculationList";
import { CharacterCard } from "../CharacterCard";
import { Spinner } from "../Spinner";
import { SubstatPriorityTable } from "../SubstatPriorityTable";
import axios from "axios";

type ExpandedRowBuildsProps = {
  row: any;
  isProfile: boolean;
};

export const ExpandedRowBuilds: React.FC<ExpandedRowBuildsProps> = ({
  row,
  isProfile,
}) => {
  const [isFetching, setIsFetching] = useState(true);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [iterator, setIterator] = useState(1);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [_calculations, setCalculations] = useState<{
    calculations: any[];
    chartsData: any;
  }>({
    calculations: [],
    chartsData: {},
  });
  const [selectedCalculationId, setSelectedCalculationId] = useState<string>();

  const getArtifacts = async () => {
    if (!row.md5) return;
    setIsFetching(true);
    const _uid = encodeURIComponent(row.uid);
    const _md5 = encodeURIComponent(row.md5);
    const artDetailsURL = `/api/artifacts/${_uid}/${_md5}`;
    const { data } = await axios.get(artDetailsURL);
    setArtifacts(data.data);
    setIsFetching(false);
  };

  const getCalculations = async () => {
    if (!row.md5) return;
    const _uid = encodeURIComponent(row.uid);
    const _md5 = encodeURIComponent(row.md5);
    const calcDetailsURL = `/api/leaderboards/${_uid}/${_md5}`;
    const opts = {
      params: {
        variant: isProfile ? "profilePage" : "",
      },
    };
    const { data } = await axios.get(calcDetailsURL, opts);
    setCalculations(data.data);
  };

  useEffect(() => {
    getCalculations();
    getArtifacts();
  }, []);

  const errorCallback = async () => {
    setDisableAnimations(true);
    setIterator((prev) => prev + 1);

    // setIsFetching(true);
    // await delay(1);
    // setIsFetching(false);
  };

  const content = (
    <>
      {isProfile ? (
        <>
          <CharacterCard
            row={row}
            artifacts={artifacts}
            _calculations={_calculations}
            setSelectedCalculationId={setSelectedCalculationId}
            errorCallback={errorCallback}
          />
          <div>
            <SubstatPriorityTable
              row={row}
              selectedCalculationId={selectedCalculationId}
            />
            <CalculationList
              row={row}
              calculations={_calculations.calculations}
            />
          </div>
        </>
      ) : (
        <>
          <ArtifactListCompact row={row} artifacts={artifacts} />
          <CalculationList
            row={row}
            calculations={_calculations.calculations}
          />
        </>
      )}
    </>
  );

  return (
    <div
      key={iterator}
      className={`flex expanded-row ${disableAnimations ? "disable-anim" : ""}`}
    >
      {isFetching ? <Spinner /> : content}
    </div>
  );
};
