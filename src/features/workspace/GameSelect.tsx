// SPDX-License-Identifier: AGPL-3.0-or-later
import { FileType2, Gamepad2 } from "lucide-react";

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useI18n } from "@/features/i18n/I18nProvider";
import { availableGameLoaders } from "@/state/loaders";
import { useWorkspace } from "@/state/workspace-store";

export function GameSelect() {
  const { t } = useI18n();
  const { selectGameLoader } = useWorkspace();

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <ItemGroup className="w-[min(560px,90%)]" data-testid="game-select">
        {availableGameLoaders().map((loader) => {
          // Default = a specific game (gamepad); GameLoader.icon === "generic"
          // opts a loader out (e.g. generic-ini isn't tied to any one game).
          const Icon = loader.icon === "generic" ? FileType2 : Gamepad2;
          return (
            <Item
              key={loader.id}
              asChild
              variant="outline"
              className="cursor-pointer"
              data-testid={`game-select-${loader.id}`}
            >
              <button type="button" onClick={() => selectGameLoader(loader.id)}>
                <ItemMedia variant="icon">
                  <Icon aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{loader.displayName}</ItemTitle>
                  <ItemDescription>{t(`gameSelect.${loader.id}.description`)}</ItemDescription>
                </ItemContent>
              </button>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}
