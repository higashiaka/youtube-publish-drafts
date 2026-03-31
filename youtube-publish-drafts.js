(async () => {
    const DEFAULT_ELEMENT_TIMEOUT_MS = 5000;
    const TIMEOUT_STEP_MS = 50;
    const RETRY_INTERVAL_MS = 100;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function click(element) {
        if (!element || element.hasAttribute('disabled') || element.disabled) return false;
        // 새로운 버튼 구조는 mousedown/mouseup이 세트로 발생해야 트리거됨
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
    }

    async function processVideos() {
        const videoRows = [...document.querySelectorAll('ytcp-video-row')];
        console.log(`[작업 시작] 총 ${videoRows.length}개의 영상을 처리합니다.`);

        for (let idx = 0; idx < videoRows.length; idx++) {
            const row = videoRows[idx];
            const editBtn = row.querySelector('.edit-draft-button');
            if (!editBtn) continue;

            console.log(`[${idx + 1}/${videoRows.length}] 수정 창 여는 중...`);
            click(editBtn);

            let modal = null;
            for (let t = 0; t < 50; t++) {
                modal = document.querySelector('ytcp-uploads-dialog');
                if (modal) break;
                await sleep(50);
            }
            if (!modal) continue;

            // --- 2. '다음' 버튼 3번 클릭 ---
            for (let i = 1; i <= 3; i++) {
                let clicked = false;
                while (!clicked) {
                    const nextBtn = modal.querySelector('#next-button');
                    if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute('disabled')) {
                        if (click(nextBtn)) {
                            clicked = true;
                            await sleep(150);
                        }
                    } else {
                        await sleep(RETRY_INTERVAL_MS);
                    }
                }
            }

            // --- 3. 최종 저장 버튼 클릭 ---
            let saved = false;
            while (!saved) {
                const saveBtn = modal.querySelector('#done-button');
                if (saveBtn && !saveBtn.disabled) {
                    if (click(saveBtn)) {
                        console.log(`[${idx + 1}/${videoRows.length}] 저장 클릭`);
                        saved = true;
                    }
                } else {
                    await sleep(RETRY_INTERVAL_MS);
                }
            }

            // --- 4. 결과창 닫기 및 모달 소멸 동시 감시 ---
            let closed = false;
            let checkCount = 0;
            const MAX_CHECKS = 150;

            while (!closed) {
                await sleep(200);
                checkCount++;

                const mainModal = document.querySelector('ytcp-uploads-dialog');
                if (!mainModal || mainModal.offsetParent === null) {
                    console.log(`[${idx + 1}/${videoRows.length}] ✅ 모달 소멸 확인`);
                    closed = true;
                    break;
                }

                // [최종 보강된 선택자] 보내주신 HTML 구조(ytcpButtonShapeImplHost) 반영
                const selectors = [
                    'button[aria-label="닫기"]',
                    'button[aria-label="Close"]',
                    '.ytcpButtonShapeImplHost[aria-label="닫기"]',
                    'ytcp-video-share-dialog #close-button',
                    'ytcp-button[label="닫기"]'
                ];

                for (let sel of selectors) {
                    const btns = document.querySelectorAll(sel);
                    for (let btn of btns) {
                        // 화면에 보이는 버튼인지 확인
                        if (btn && btn.offsetParent !== null) {
                            click(btn);
                            
                            // 버튼 내부 텍스트가 "닫기"인 경우 한 번 더 확실히 클릭
                            const textContent = btn.querySelector('.ytcpButtonShapeImpl__button-text-content');
                            if (textContent) click(textContent);

                            await sleep(150);
                            break;
                        }
                    }
                }

                if (checkCount >= MAX_CHECKS) {
                    console.error(`[중단] 결과창 미감지 타임아웃.`);
                    return;
                }
            }

            console.log(`[${idx + 1}/${videoRows.length}] 작업 완료 ✓`);
            await sleep(100);
        }
        console.log("[전체 종료]");
    }

    processVideos();
})();
