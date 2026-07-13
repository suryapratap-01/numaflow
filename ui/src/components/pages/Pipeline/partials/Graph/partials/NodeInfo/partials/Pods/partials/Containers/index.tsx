import Box from "@mui/material/Box";
import { ContainerProps } from "../../../../../../../../../../../types/declarations/pods";

import "./style.css";

export function Containers(props: ContainerProps) {
  const { pod, containerName: container, handleContainerClick } = props;
  if (!pod) return null;

  return (
    <Box className="containers-segmented" sx={{ width: "100%" }}>
      <Box className="containers-segmented-track">
        {pod?.containers?.map((c: string) => {
          const active = container === c;
          return (
            <button
              type="button"
              data-testid={`${pod?.name}-${c}`}
              key={c}
              className={`containers-segmented-btn${
                active ? " containers-segmented-btn-active" : ""
              }`}
              onClick={() => handleContainerClick(c)}
              title={c}
            >
              {c}
            </button>
          );
        })}
      </Box>
    </Box>
  );
}
