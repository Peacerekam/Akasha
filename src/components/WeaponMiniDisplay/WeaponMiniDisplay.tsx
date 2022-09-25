export const WeaponMiniDisplay = ({
  icon,
  refinement,
}: {
  icon: string;
  refinement: number;
}) => {
  return (
    <div className="table-icon-text-pair relative">
      <img
        src={icon}
        className="table-icon"
      />
      <span  className="bottom-right-absolute">
        R{refinement}
      </span>
    </div>
  );
};
