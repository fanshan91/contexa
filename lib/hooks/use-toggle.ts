import * as React from "react";

type UseToggleOptions = {
  initial?: boolean;
};

function useToggle(options: UseToggleOptions = {}) {
  const { initial = false } = options;
  const [value, setValue] = React.useState<boolean>(initial);

  const toggle = React.useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const setOn = React.useCallback(() => setValue(true), []);
  const setOff = React.useCallback(() => setValue(false), []);

  return { value, setValue, toggle, setOn, setOff };
}

export { useToggle };

