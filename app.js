/**
 * XML/HTML Pushdown Automata (PDA) Tag Validator
 * Theory of Computation Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const xmlInput = document.getElementById('xml-input');
    const btnValidate = document.getElementById('btn-validate');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');
    const tokenCountBadge = document.getElementById('token-count');
    const tokenStream = document.getElementById('token-stream');

    const resultBanner = document.getElementById('result-banner');
    const resultTitle = document.getElementById('result-title');
    const resultSummary = document.getElementById('result-summary');
    const resultDetails = document.getElementById('result-details');
    const resultIcon = document.getElementById('result-icon');

    const currentStateBadge = document.getElementById('current-state-badge');
    const currentTagVal = document.getElementById('current-tag-val');
    const currentActionVal = document.getElementById('current-action-val');
    const stackDisplay = document.getElementById('stack-display');
    const stackCount = document.getElementById('stack-count');
    const logBody = document.getElementById('log-body');
    const btnClearLog = document.getElementById('btn-clear-log');

    const theoryModal = document.getElementById('theory-modal');
    const btnTheoryToggle = document.getElementById('btn-theory-toggle');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // Preset buttons
    const presetButtons = document.querySelectorAll('.btn-preset');

    // --- State Variables ---
    let autoRunInterval = null;
    let stepSpeed = parseInt(speedSlider.value, 10);

    // --- PDA Engine Class ---
    class PushdownAutomaton {
        constructor() {
            this.reset('');
        }

        reset(rawInput) {
            this.rawInput = rawInput;
            this.tokens = this.tokenize(rawInput);
            this.tokenIndex = 0;
            this.stack = ['Z₀']; // Initial stack symbol Z₀
            this.currentState = 'q0'; // Initial state q₀
            this.stepCount = 0;
            this.isHalted = false;
            this.result = 'IDLE'; // IDLE, ACCEPTED, REJECTED
            this.errorMessage = '';
            this.expectedTag = '';
            this.foundTag = '';
            this.lastAction = 'INITIALIZED';
            this.history = [];
            this.failedTokenIndex = -1;
        }

        /**
         * Tokenize XML/HTML string into tokens:
         * OPEN_TAG (<name>), CLOSE_TAG (</name>), TEXT (content), SYNTAX_ERROR (<unclosed)
         */
        tokenize(input) {
            if (!input || input.trim() === '') return [];

            const tokens = [];
            const regex = /(<\/?[a-zA-Z0-9_-]+[^>]*>)|([^<]+)|(<[^>]*$)/g;
            let match;

            while ((match = regex.exec(input)) !== null) {
                const tagMatch = match[1];
                const textMatch = match[2];
                const errorMatch = match[3];

                if (tagMatch) {
                    const cleanTag = tagMatch.trim();
                    if (cleanTag.startsWith('</')) {
                        // Closing Tag
                        const tagName = cleanTag.substring(2, cleanTag.length - 1).trim().split(/\s+/)[0];
                        tokens.push({
                            type: 'CLOSE_TAG',
                            name: tagName,
                            raw: cleanTag
                        });
                    } else if (cleanTag.startsWith('<')) {
                        // Opening Tag
                        let inner = cleanTag.substring(1, cleanTag.length - 1).trim();
                        const isSelfClosing = inner.endsWith('/');
                        if (isSelfClosing) {
                            inner = inner.substring(0, inner.length - 1).trim();
                        }
                        const tagName = inner.split(/\s+/)[0];
                        
                        tokens.push({
                            type: isSelfClosing ? 'SELF_CLOSING' : 'OPEN_TAG',
                            name: tagName,
                            raw: cleanTag
                        });
                    }
                } else if (textMatch) {
                    const textContent = textMatch.trim();
                    if (textContent.length > 0) {
                        tokens.push({
                            type: 'TEXT',
                            name: textContent,
                            raw: textContent
                        });
                    }
                } else if (errorMatch) {
                    tokens.push({
                        type: 'SYNTAX_ERROR',
                        name: errorMatch,
                        raw: errorMatch
                    });
                }
            }
            return tokens;
        }

        /**
         * Step forward 1 transition in the PDA.
         * Processes EXACTLY one XML/HTML tag token per call.
         */
        step() {
            if (this.isHalted) return false;

            this.stepCount++;

            // If we are at state q0, transition q0 -> q1 on first step
            if (this.currentState === 'q0') {
                this.currentState = 'q1';
            }

            // Check if all tokens have already been processed
            if (this.tokenIndex >= this.tokens.length) {
                const topSymbol = this.getTopStack();
                if (this.stack.length === 1 && topSymbol === 'Z₀') {
                    // ACCEPT: Only Z0 remains on stack -> q_accept
                    this.currentState = 'q_accept';
                    this.result = 'ACCEPTED';
                    this.isHalted = true;
                    this.lastAction = 'ACCEPT';
                    this.recordHistory('q1/q2', 'EOF', 'Z₀', 'q_accept', 'ACCEPT');
                } else {
                    // REJECT: Unclosed tag remains on stack -> q_reject
                    this.currentState = 'q_reject';
                    this.result = 'REJECTED';
                    this.isHalted = true;
                    this.expectedTag = `</${topSymbol}>`;
                    this.foundTag = `EOF (Unclosed <${topSymbol}>)`;
                    this.errorMessage = `Expected: </${topSymbol}>\nFound: EOF\nAction: REJECT`;
                    this.lastAction = 'REJECT';
                    this.recordHistory('q1/q2', 'EOF', topSymbol, 'q_reject', 'REJECT');
                }
                return true;
            }

            // Process current tag token at tokenIndex
            const token = this.tokens[this.tokenIndex];
            const topSymbol = this.getTopStack();

            if (token.type === 'SYNTAX_ERROR') {
                this.currentState = 'q_reject';
                this.result = 'REJECTED';
                this.isHalted = true;
                this.failedTokenIndex = this.tokenIndex;
                this.expectedTag = `'>' bracket`;
                this.foundTag = token.raw;
                this.errorMessage = `Expected: closing '>' bracket\nFound: ${token.raw}\nAction: REJECT`;
                this.lastAction = 'REJECT';
                this.recordHistory('q1', token.raw, topSymbol, 'q_reject', 'REJECT');
                this.tokenIndex++;
                return true;
            }

            if (token.type === 'TEXT') {
                // Text content inside tags does not alter the stack
                this.lastAction = `READ("${token.name}")`;
                this.recordHistory(this.currentState, `"${token.name}"`, topSymbol, this.currentState, 'READ');
                this.tokenIndex++;
                return true;
            }

            if (token.type === 'SELF_CLOSING') {
                // Self-closing tag <br/> does not alter the stack
                this.lastAction = `READ(<${token.name}/>)`;
                this.recordHistory(this.currentState, token.raw, topSymbol, this.currentState, 'READ');
                this.tokenIndex++;
                return true;
            }

            if (token.type === 'OPEN_TAG') {
                // OPENING TAG: Push tag name onto stack! State q1
                this.currentState = 'q1';
                this.stack.push(token.name);
                this.lastAction = `PUSH(${token.name})`;
                this.recordHistory('q1', token.raw, topSymbol, 'q1', `PUSH(${token.name})`);
                this.tokenIndex++;
                return true;
            }

            if (token.type === 'CLOSE_TAG') {
                // CLOSING TAG: Check against TOP of stack
                if (topSymbol === 'Z₀') {
                    // Stack underflow rejection: Closing tag when no opening tag was pushed
                    this.currentState = 'q_reject';
                    this.result = 'REJECTED';
                    this.isHalted = true;
                    this.failedTokenIndex = this.tokenIndex;
                    this.expectedTag = `<${token.name}>`;
                    this.foundTag = `</${token.name}>`;
                    this.errorMessage = `Expected: <${token.name}>\nFound: </${token.name}>\nAction: REJECT`;
                    this.lastAction = 'REJECT';
                    this.recordHistory('q1', token.raw, 'Z₀', 'q_reject', 'REJECT');
                    this.tokenIndex++;
                    return true;
                }

                if (topSymbol === token.name) {
                    // MATCH! Pop top tag from stack. State q2
                    this.currentState = 'q2';
                    this.stack.pop();
                    this.lastAction = `POP(${token.name})`;
                    this.recordHistory('q2', token.raw, topSymbol, 'q2', `POP(${token.name})`);
                    this.tokenIndex++;
                    return true;
                } else {
                    // MISMATCH! Tag does not match top of stack -> q_reject
                    this.currentState = 'q_reject';
                    this.result = 'REJECTED';
                    this.isHalted = true;
                    this.failedTokenIndex = this.tokenIndex;
                    this.expectedTag = `</${topSymbol}>`;
                    this.foundTag = `</${token.name}>`;
                    this.errorMessage = `Expected: </${topSymbol}>\nFound: </${token.name}>\nAction: REJECT`;
                    this.lastAction = 'REJECT';
                    this.recordHistory('q1/q2', token.raw, topSymbol, 'q_reject', 'REJECT');
                    this.tokenIndex++;
                    return true;
                }
            }

            return false;
        }

        getTopStack() {
            return this.stack.length > 0 ? this.stack[this.stack.length - 1] : 'EMPTY';
        }

        recordHistory(fromState, symbol, stackTop, toState, action) {
            this.history.push({
                step: this.stepCount,
                fromState,
                symbol,
                stackTop,
                toState,
                action,
                stackSnapshot: [...this.stack]
            });
        }
    }

    // Initialize PDA Instance
    const pda = new PushdownAutomaton();

    // --- UI Update Rendering ---
    function updateUI() {
        // Token count badge
        tokenCountBadge.textContent = `${pda.tokens.length} Token${pda.tokens.length === 1 ? '' : 's'}`;

        // Render Parsed Token Stream Tracker
        renderTokenStream();

        // Current State Badge
        currentStateBadge.textContent = stateLabel(pda.currentState);
        currentStateBadge.className = `state-tag ${pda.currentState}`;

        // Highlights in State Nodes Diagram
        document.querySelectorAll('.state-node').forEach(node => {
            const nodeState = node.getAttribute('data-state');
            if (nodeState === pda.currentState) {
                node.classList.add('active');
            } else {
                node.classList.remove('active');
            }
        });

        // Current Active Tag Display
        if (pda.tokenIndex > 0 && pda.tokenIndex <= pda.tokens.length) {
            const currTok = pda.tokens[pda.tokenIndex - 1];
            currentTagVal.textContent = currTok.raw;
        } else if (pda.tokenIndex === 0 && pda.tokens.length > 0) {
            currentTagVal.textContent = `Next: ${pda.tokens[0].raw}`;
        } else {
            currentTagVal.textContent = '— (EOF)';
        }

        // Current Action Display
        currentActionVal.textContent = pda.lastAction;

        // Render Memory Stack Centerpiece Blocks
        renderStack();

        // Render Result Banner
        renderResultBanner();

        // Render Log Table
        renderLogTable();

        // STEP Button State: Disable if simulation is halted (q_accept or q_reject)
        btnStep.disabled = pda.isHalted;
    }

    function renderTokenStream() {
        tokenStream.innerHTML = '';
        if (pda.tokens.length === 0) {
            tokenStream.innerHTML = `<span class="token-pill pending">No input tokens</span>`;
            return;
        }

        pda.tokens.forEach((token, idx) => {
            const pill = document.createElement('div');
            pill.className = 'token-pill';
            pill.textContent = token.raw;

            if (idx === pda.failedTokenIndex) {
                pill.classList.add('rejected');
            } else if (idx < pda.tokenIndex) {
                pill.classList.add('processed');
            } else if (idx === pda.tokenIndex && !pda.isHalted) {
                pill.classList.add('active');
            } else {
                pill.classList.add('pending');
            }

            tokenStream.appendChild(pill);
        });
    }

    function stateLabel(st) {
        switch (st) {
            case 'q0': return 'q₀ (Initial State)';
            case 'q1': return 'q₁ (Opening Tag)';
            case 'q2': return 'q₂ (Closing Tag)';
            case 'q_accept': return 'q_accept (Accepted)';
            case 'q_reject': return 'q_reject (Rejected)';
            default: return st;
        }
    }

    /**
     * Render Physical Stack Blocks Centerpiece
     */
    function renderStack() {
        stackDisplay.innerHTML = '';
        stackCount.textContent = `${pda.stack.length} Block${pda.stack.length === 1 ? '' : 's'}`;

        pda.stack.forEach((item, index) => {
            const block = document.createElement('div');
            const isTop = index === pda.stack.length - 1;

            block.className = `stack-block ${isTop ? 'top-block' : ''}`;
            
            if (item === 'Z₀') {
                block.classList.add('bottom-marker');
                block.innerHTML = `
                    ${isTop ? '<span class="top-indicator-tag">TOP</span>' : ''}
                    <span class="block-symbol">Z₀</span>
                    <span class="block-subtext">Bottom-of-stack marker</span>
                `;
            } else {
                if (isTop) {
                    block.classList.add('pushing');
                }
                block.innerHTML = `
                    ${isTop ? '<span class="top-indicator-tag">TOP</span>' : ''}
                    <span class="block-symbol">&lt;${item}&gt;</span>
                    <span class="block-subtext">Opening Tag Block</span>
                `;
            }

            stackDisplay.appendChild(block);
        });

        // Scroll stack column to show top block
        stackDisplay.scrollTop = stackDisplay.scrollHeight;
    }

    function renderResultBanner() {
        resultBanner.className = `result-banner ${pda.result.toLowerCase()}`;
        resultDetails.classList.add('hidden');

        if (pda.result === 'IDLE') {
            resultTitle.textContent = 'Ready for Step Simulation';
            resultSummary.textContent = 'Click Step (Process 1 Tag) to process tags step by step, or Auto Validate.';
            resultIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        } else if (pda.result === 'ACCEPTED') {
            resultTitle.textContent = 'q_accept (Accepted)';
            resultSummary.textContent = 'All XML/HTML tags are properly nested and balanced! Only Z₀ remains on stack.';
            resultIcon.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (pda.result === 'REJECTED') {
            resultTitle.textContent = 'q_reject (Rejected)';
            resultSummary.textContent = 'Invalid tag structure detected.';
            resultIcon.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            
            resultDetails.classList.remove('hidden');
            resultDetails.innerHTML = `
                <strong>Mismatch Diagnostic:</strong><br>
                Expected: <code>${escapeHtml(pda.expectedTag)}</code><br>
                Found: <code>${escapeHtml(pda.foundTag)}</code><br>
                Action: <strong class="text-reject">REJECT</strong>
            `;
        }
    }

    function renderLogTable() {
        if (pda.history.length === 0) {
            logBody.innerHTML = `
                <tr class="log-empty">
                    <td colspan="5">No execution steps yet. Click Step or Auto Validate.</td>
                </tr>
            `;
            return;
        }

        logBody.innerHTML = '';
        pda.history.forEach(item => {
            const tr = document.createElement('tr');
            
            let actionClass = '';
            if (item.action.startsWith('PUSH')) actionClass = 'log-action-push';
            else if (item.action.startsWith('POP')) actionClass = 'log-action-pop';
            else if (item.action.startsWith('REJECT')) actionClass = 'log-action-reject';
            else if (item.action.startsWith('ACCEPT')) actionClass = 'log-action-accept';

            tr.innerHTML = `
                <td>#${item.step}</td>
                <td><code>${item.toState}</code></td>
                <td><code>${escapeHtml(item.symbol)}</code></td>
                <td class="${actionClass}">${escapeHtml(item.action)}</td>
                <td><code>${item.stackSnapshot.join(', ')}</code></td>
            `;
            logBody.appendChild(tr);
        });

        // Auto-scroll log table to bottom
        const logContainer = document.querySelector('.log-table-container');
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- Control Handlers ---
    function stopAutoRun() {
        if (autoRunInterval) {
            clearInterval(autoRunInterval);
            autoRunInterval = null;
        }
        btnValidate.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            Auto Validate
        `;
        btnValidate.classList.remove('btn-primary');
        btnValidate.classList.add('btn-secondary');
    }

    function handleReset() {
        stopAutoRun();
        pda.reset(xmlInput.value);
        updateUI();
    }

    function handleStep() {
        if (pda.isHalted) return;
        pda.step();
        updateUI();
    }

    function handleAutoValidate() {
        if (autoRunInterval) {
            stopAutoRun();
            return;
        }

        if (pda.isHalted || pda.stepCount === 0) {
            pda.reset(xmlInput.value);
            updateUI();
        }

        btnValidate.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            Pause
        `;
        btnValidate.classList.remove('btn-secondary');
        btnValidate.classList.add('btn-primary');

        autoRunInterval = setInterval(() => {
            if (pda.isHalted) {
                stopAutoRun();
                return;
            }
            pda.step();
            updateUI();
        }, stepSpeed);
    }

    // --- Event Listeners ---
    xmlInput.addEventListener('input', () => {
        handleReset();
    });

    btnReset.addEventListener('click', handleReset);
    btnStep.addEventListener('click', handleStep);
    btnValidate.addEventListener('click', handleAutoValidate);

    speedSlider.addEventListener('input', (e) => {
        stepSpeed = parseInt(e.target.value, 10);
        speedLabel.textContent = `${stepSpeed}ms`;
        if (autoRunInterval) {
            clearInterval(autoRunInterval);
            autoRunInterval = setInterval(() => {
                if (pda.isHalted) {
                    stopAutoRun();
                    return;
                }
                pda.step();
                updateUI();
            }, stepSpeed);
        }
    });

    btnClearLog.addEventListener('click', () => {
        pda.history = [];
        renderLogTable();
    });

    // Preset selection buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const testCode = btn.getAttribute('data-test');
            xmlInput.value = testCode;
            handleReset();
        });
    });

    // Theory Modal Controls
    btnTheoryToggle.addEventListener('click', () => {
        theoryModal.classList.remove('hidden');
    });

    btnCloseModal.addEventListener('click', () => {
        theoryModal.classList.add('hidden');
    });

    theoryModal.addEventListener('click', (e) => {
        if (e.target === theoryModal) {
            theoryModal.classList.add('hidden');
        }
    });

    // Initialize UI on page load
    handleReset();
});
