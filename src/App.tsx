import { useOpt } from "./react-opt";
import type { MyApi } from "./opt";

function App() {
  const opt = useOpt<MyApi>();

  const { data } = opt.useQuery({
    resourceId: "/users/:userId/version",
    params: { userId: "1" },
  });

  return (
    <button
      type="button"
      onClick={async () => {
        await opt.mutate({
          apiId: "POST /users/:userId/version/increase",
          params: { userId: "1" },
          headers: {
            "x-user-credential": "correct",
          },
          body: {
            increaseBy: 2,
          },
        });
      }}
    >
      Version: {data?.version}
    </button>
  );
}

export default App;
