interface PlannerCircularLoadingStateProps {
  label?: string;
  sublabel?: string;
}

export default function PlannerCircularLoadingState({
  label = 'Buscando hoteles',
  sublabel = 'Estamos consultando opciones reales para este destino.',
}: PlannerCircularLoadingStateProps) {
  return (
    <div className="planner-hotel-loader" aria-live="polite" aria-busy="true">
      <div className="planner-hotel-loader__visual" aria-hidden="true">
        <div className="planner-hotel-loader__halo" />
        <div className="planner-hotel-loader__ring">
          <div className="planner-hotel-loader__arc" />
        </div>
      </div>
      <p className="trip-planner-label planner-hotel-loader__label">{label}</p>
      <p className="trip-planner-body planner-hotel-loader__sublabel">{sublabel}</p>
    </div>
  );
}
