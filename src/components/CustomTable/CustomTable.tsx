import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronUp } from "@fortawesome/free-solid-svg-icons";
// import PerfectScrollbar from "react-perfect-scrollbar";
import {
  CalculationList,
  StatIcon,
  Spinner,
  Pagination,
  ArtifactListCompact,
  TableHoverElement,
} from "../../components";
import { arrayPushOrSplice, normalizeText } from "../../utils/helpers";
import { FiltersContainer, FilterOption } from "./Filters";
// import { useNavigate } from "react-router-dom";
import "./style.scss";

type CustomTableProps = {
  columns: any[];
  filtersURL?: string;
  fetchURL?: string;
  fetchParams?: any;
  defaultSort?: string;
  calculationColumn?: string;
  expandableRows?: boolean;
  hidePagination?: boolean;
  initialData?: {
    rows: any[];
    totalRows: number;
  };
};

export type FetchParams = {
  sort: string;
  order: number;
  size: number;
  page: number;
  filter?: string;
};

export const CustomTable: React.FC<CustomTableProps> = ({
  fetchURL = null,
  fetchParams = {},
  columns = [],
  filtersURL,
  defaultSort = null,
  calculationColumn = "",
  expandableRows = false,
  hidePagination = false,
  initialData = null,
  // dataFeed = null,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [listingType, setListingType] = useState<"table" | "custom">("table");
  const [hoverPreview, setHoverPreview] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [totalRowsCount, setTotalRowsCount] = useState<number>(0);

  const defaultParams = {
    sort: defaultSort || "",
    order: -1,
    size: 20,
    page: 1,
    filter: "",
  };
  const [params, setParams] = useState<FetchParams>(defaultParams);

  // const navigate = useNavigate();

  const noDataFound = useMemo(
    () => rows.length === 0 && !isLoading,
    [rows.length, isLoading]
  );

  // const appendParamsToURL = () => {
  //   let tmp: string[] = [];
  //   for (const key of Object.keys(params)) {
  //     const value = (params as any)[key];
  //     if ((defaultParams as any)[key] === value) continue;

  //     tmp.push(`${key}=${value}`);
  //   }
  //   const toAppend = tmp.join("&");
  //   const newURL = `${window.location.pathname}?${toAppend}`;
  //   navigate(newURL);
  // };

  // const readParamsFromURL = () => {
  //   const query = new URLSearchParams(window.location.search);
  //   const tmp: any = {};
  //   query.forEach((value, key) => {
  //     if ((defaultParams as any)[key].toString() !== value) {
  //       tmp[key] = value;
  //     }
  //   });

  //   setParams((prev) => ({
  //     ...prev,
  //     ...tmp
  //   }));
  // };

  // useEffect(() => {
  //   // readParamsFromURL();
  //   // make new props to not let table project onto URL (2 tables on 1 page)
  // }, []);

  useEffect(() => {
    // appendParamsToURL();
    console.log("useEffect params/fetchURL", params, fetchURL);

    if (initialData && rows.length === 0) {
      setIsLoading(true);
      if (initialData.rows.length === 0) return;

      setRows(initialData.rows);
      setTotalRowsCount(initialData.totalRows);
      setIsLoading(false);
    } else if (fetchURL) {
      const abortController = new AbortController();
      handleFetch(abortController);
      return () => {
        abortController.abort();
      };
    }
  }, [JSON.stringify(params), fetchURL, initialData]);

  useEffect(() => {
    console.log("useEffect expandedRows", expandedRows);

    setRows((prev) => {
      let newRows = prev.filter((row) => !row.isExpandRow);
      for (const expandedRowId of expandedRows) {
        const index = newRows.findIndex((row) => row._id === expandedRowId);
        if (index === -1) continue;

        const newRow = {
          ...newRows[index],
          isExpandRow: true,
        };

        const cutoffIndex = index + 1;
        newRows.splice(cutoffIndex, 0, newRow);
      }
      return newRows;
    });
  }, [JSON.stringify(expandedRows)]);

  const handleFetch = async (abortController: AbortController) => {
    if (!fetchURL) return;

    try {
      setIsLoading(true);

      const opts = {
        signal: abortController.signal,
        params: {
          ...params,
          ...fetchParams,
        },
      } as any;
      const response = await axios.get(fetchURL, opts);
      const { data, totalRows } = response.data;

      setExpandedRows([]);
      setTotalRowsCount(totalRows);
      setRows(data);
      setIsLoading(false);
    } catch (err) {}

    // if (dataFeed) dataFeed(data)
  };

  const tableClassNames = useMemo(
    () =>
      [
        "custom-table",
        params.sort?.startsWith("substats") // || params.sort === "critValue"
          ? `highlight-${normalizeText(params.sort?.replace("substats", ""))}`
          : "",
      ]
        .join(" ")
        .trim(),
    [params.sort]
  );

  const renderHeaders = useMemo(() => {
    const handleSetSort = (sortField: string) => {
      setParams((prev) => ({
        ...prev,
        sort: sortField,
        order: sortField === prev.sort ? prev.order * -1 : -1,
      }));
    };

    const handleClickHeader = (
      column: any,
      event: React.MouseEvent<HTMLTableCellElement, MouseEvent>
    ) => {
      const { sortable, sortField, sortFields } = column;
      if (!sortable || !sortField) return;
      handleSetSort(sortField);
    };

    const displaySortIcon = (order: number = 1) => {
      const iconClassNames = [
        "sort-direction-icon",
        order === -1 ? "rotate-180deg" : "",
      ]
        .join(" ")
        .trim();

      return (
        <FontAwesomeIcon
          className={iconClassNames}
          // icon={params.order === -1 ? faChevronDown : faChevronUp}
          icon={faChevronUp}
          size="1x"
        />
      );
    };

    const renderSortField = (key: string, index: number) => {
      const displayKey = key.split(".").pop(); // get last
      if (!displayKey) return null;
      const isHighlighted = params.sort && key === params.sort;
      const classNames = [
        "flex nowrap gap-5",
        isHighlighted ? "highlight-cell" : "",
      ]
        .join(" ")
        .trim();

      return (
        <div
          key={key}
          className={classNames}
          onClick={() => handleSetSort(key)}
        >
          <StatIcon name={displayKey} />
          {displayKey}
          {isHighlighted ? displaySortIcon(params.order) : null}
        </div>
      );
    };

    return columns.map((column: any, index) => {
      const { name, sortable, sortField, sortFields, colSpan } = column;
      const isHighlighted =
        params.sort &&
        (sortField === params.sort || sortFields?.includes(params.sort));
      const classNames = [
        "relative",
        isHighlighted ? "highlight-cell" : "",
        sortable ? "sortable-column" : "",
      ]
        .join(" ")
        .trim();

      let columnName = name;

      if (sortFields?.includes(params.sort)) {
        const key = params.sort.split(".").pop();
        if (!key) return null;
        columnName = (
          <>
            <StatIcon name={key} /> {key}
          </>
        );
      }

      return (
        <th
          key={`${name}-${index}`}
          className={classNames}
          onClick={(event) => handleClickHeader(column, event)}
          colSpan={isHighlighted ? colSpan ?? 0 : 1}
          style={{
            width: column.width,
            display: isHighlighted && colSpan === 0 ? "none" : "",
          }}
        >
          <span className="header-wrapper">
            {columnName}
            {isHighlighted ? displaySortIcon(params.order) : null}
          </span>
          {sortFields && (
            <span className="sort-fields-picker-wrapper">
              {sortFields.map(renderSortField)}
            </span>
          )}
        </th>
      );
    });
  }, [columns, params.order, params.sort]);

  const renderExpandRow = useCallback(
    (row: any) => (
      <>
        <ArtifactListCompact row={row} />
        <CalculationList row={row} />
      </>
    ),
    []
  );

  const renderRows = useMemo(() => {
    console.log("useMemo renderRows", rows);

    const updateTableHoverElement = (props: any) => {
      const el = (
        <TableHoverElement
          currentCategory={calculationColumn}
          listingType={listingType}
          {...props}
        />
      );
      setHoverPreview(el);
    };

    const handleClickRow = (row: any) => {
      if (!expandableRows) return;
      setExpandedRows((prev) => arrayPushOrSplice(prev, row._id));
    };

    return rows.map((row) => {
      const { isExpandRow } = row;
      if (isExpandRow) {
        return (
          <tr key={`${row._id}-expanded`} className="expanded-tr">
            <td colSpan={columns.length}>{renderExpandRow(row)}</td>
          </tr>
        );
      }
      return (
        <tr
          key={row._id}
          className={expandableRows ? "pointer" : ""}
          onMouseEnter={() => updateTableHoverElement({ row })}
          onMouseLeave={() => updateTableHoverElement({ hide: true })}
          onClick={() => handleClickRow(row)}
        >
          {columns.map((column, index) => {
            const { sortField, getDynamicTdClassName } = column;
            const isHighlighted = params.sort && sortField === params.sort;

            const tdClassNames = [
              isHighlighted ? "highlight-cell" : "",
              getDynamicTdClassName ? getDynamicTdClassName(row) : "",
            ]
              .join(" ")
              .trim();

            return (
              <td
                style={{ width: column.width }}
                className={tdClassNames}
                key={`${sortField}-${index}`}
              >
                {column.cell(row)}
              </td>
            );
          })}
        </tr>
      );
    });
  }, [
    // JSON.stringify(expandedRows),
    // params.sort,
    JSON.stringify(rows),
    listingType,
    calculationColumn,
    columns.length,
  ]);

  const noDataRow = useMemo(
    () => (
      <tr>
        <td colSpan={columns.length}>
          <div style={{ textAlign: "center" }}>No data found</div>
        </td>
      </tr>
    ),
    [columns.length]
  );

  const wrapperClassNames = [
    "custom-table-wrapper",
    isLoading ? "disable-table" : "",
  ]
    .join(" ")
    .trim();

  const fillerRow = useMemo(() => {
    if (totalRowsCount < params.size) return null;
    const realRowsCount = rows.filter((r) => !r.isExpandRow).length;
    const numOfFillerRows = params.size - realRowsCount;
    const arr = Array(numOfFillerRows).fill(0);
    return arr.map(() => (
      <tr style={{ pointerEvents: "none" }}>
        <td colSpan={columns.length}></td>
      </tr>
    ));
  }, [rows.length, columns.length, params.size, totalRowsCount]);

  const handleChangeFilters = (filters: FilterOption[]) => {
    let stringified = "";

    filters.forEach((f) => {
      if (f.name && f.value) stringified += `[${f.name}]${f.value}`;
    });

    if (params.filter === stringified) return;

    setParams((prev) => ({
      ...prev,
      page: 1,
      filter: stringified,
    }));
  };

  return (
    <div className={wrapperClassNames}>
      {hoverPreview}
      {filtersURL && (
        <FiltersContainer
          fetchURL={filtersURL}
          onFiltersChange={handleChangeFilters}
        />
      )}
      {/* <PerfectScrollbar options={{}}> */}
      <table className={tableClassNames} cellSpacing={0}>
        <thead>
          <tr>{renderHeaders}</tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr className="dark-overlay-table-only">
              <td>
                <Spinner />
              </td>
            </tr>
          )}
          {rows.length > 0 && renderRows}
          {noDataFound && noDataRow}
          {!noDataFound && fillerRow}
        </tbody>
      </table>
      {/* </PerfectScrollbar> */}
      {!hidePagination && (
        <Pagination
          pageSize={params.size}
          pageNumber={params.page}
          totalRows={totalRowsCount}
          setParams={setParams}
        />
      )}
    </div>
  );
};
