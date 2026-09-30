package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

public interface Scheduler {

    String name();

    void addToReady(SpaceCraft s, int now);

    boolean hasReady();

    /**
     * Representa quando o processo "nave" entra em estado de ready
     *
     * @param s nave que entrou no estado
     * @param now tempo em que isso ocorreu (inteiro)
     */
    void onArrival(SpaceCraft s, int now);

    /**
     * Forma com que o próximo processo será implementado
     *
     * @param now tempo em que isso ocorre
     * @return nave que foi selecionada
     */
    SpaceCraft selectNext(int now);

    /**
     * Caso houver preempção (booleano)
     *
     *
     * @param running
     * @param port
     * @param now
     * @return True: ocorre preempção False: não há
     */
    boolean shouldPreempt(SpaceCraft running, DockingPort port, int now);

    /**
     * ticks de aging se houver. Aplica o aging a cada X ticks
     *
     * @param now tempo em que ocorre
     */
    void onTick(int now);
}
