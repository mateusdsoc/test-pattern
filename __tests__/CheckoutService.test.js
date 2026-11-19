import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

const cartao = { numero: '4111111111111111', validade: '12/30' };

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        let gatewayStub;
        let repositoryDummy;
        let emailDummy;
        let checkoutService;

        beforeEach(() => {
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            repositoryDummy = { salvar: jest.fn() };
            emailDummy = { enviarEmail: jest.fn() };
            checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);
        });

        it('retorna null', async () => {
            const carrinho = new CarrinhoBuilder().build();

            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            expect(pedido).toBeNull();
        });

        it('não salva o pedido nem envia e-mail', async () => {
            const carrinho = new CarrinhoBuilder().build();

            await checkoutService.processarPedido(carrinho, cartao);

            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it('retorna o pedido salvo com o total sem desconto', async () => {
            const carrinho = new CarrinhoBuilder()
                .comItens([new Item('Teclado', 120), new Item('Mouse', 80)])
                .build();
            const pedidoSalvo = { id: 10, totalFinal: 200, status: 'PROCESSADO' };
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailDummy);

            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            expect(pedido).toBe(pedidoSalvo);
            expect(pedido.totalFinal).toBe(200);
        });

        it('cobra o valor cheio no gateway', async () => {
            const carrinho = new CarrinhoBuilder()
                .comItens([new Item('Teclado', 120), new Item('Mouse', 80)])
                .build();
            const gatewayMock = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue({ id: 11 }) };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(gatewayMock, repositoryStub, emailDummy);

            await checkoutService.processarPedido(carrinho, cartao);

            expect(gatewayMock.cobrar).toHaveBeenCalledWith(200, cartao);
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let carrinho;
        let gatewayStub;
        let repositoryStub;
        let emailMock;
        let checkoutService;

        beforeEach(() => {
            carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPremium())
                .comItens([new Item('Monitor', 150), new Item('Cabo HDMI', 50)])
                .build();
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = {
                salvar: jest.fn().mockResolvedValue({ id: 42, totalFinal: 180, status: 'PROCESSADO' }),
            };
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
        });

        it('cobra o valor com 10% de desconto', async () => {
            await checkoutService.processarPedido(carrinho, cartao);

            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartao);
        });

        it('envia um único e-mail de confirmação para o cliente', async () => {
            await checkoutService.processarPedido(carrinho, cartao);

            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                expect.stringContaining('42')
            );
        });
    });

    describe('quando o envio do e-mail falha', () => {
        it('ainda retorna o pedido salvo', async () => {
            const erroSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const carrinho = new CarrinhoBuilder().build();
            const pedidoSalvo = { id: 7, totalFinal: 50, status: 'PROCESSADO' };
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = { enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP fora do ar')) };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            expect(pedido).toBe(pedidoSalvo);
            erroSpy.mockRestore();
        });
    });
});
